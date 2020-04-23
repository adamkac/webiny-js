#!/usr/bin/env node
const chalk = require("chalk");
const envinfo = require("envinfo");
const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const execa = require("execa");
const yargs = require("yargs");
const validateProjectName = require("validate-npm-package-name");

const packageJson = require("./package.json");
const init = require("./init.js");

yargs
	.usage("Usage: $0 <project-name> [options]")
	.version(packageJson.version)
	.demandCommand(1)
	.example("$0 helloWorld --template=basic")
	.help()
	.alias("help", "h")
	.fail(function(msg, err) {
		if (msg) console.log(msg);
		if (err) console.log(err);
		process.exit(1);      
	});

yargs.command(
	"$0 <project-name>",
	"Name of application and template to use",
	yargs => {
		yargs.positional("project-name", {
			describe: "Project name"
		});
		yargs.option("template", {
			describe: "Name of template to use",
			alias: "t",
			type: "string",
			demandOption: true,
		});
	},
	(argv) => createApp(argv.projectName, argv.template))
	.argv;

yargs.command(
	"info",
	"Print environment debug information",
	{},
	() => informationHandler())
	.argv;

function checkAppName(appName) {
	const validationResult = validateProjectName(appName);
	if (!validationResult.validForNewPackages) {
		console.error(
			chalk.red(
				`Cannot create a project named ${chalk.green(
					`"${appName}"`
				)} because of npm naming restrictions:\n`
			)
		);
		[
			...(validationResult.errors || []),
			...(validationResult.warnings || []),
		].forEach(error => {
			console.error(chalk.red(`  * ${error}`));
		});
		console.error(chalk.red("\nPlease choose a different project name."));
		process.exit(1);
	}
}

function createApp(projectName, template) {
	if(!projectName) {
		console.log("You must provide a name for the project to use.");
	} else {
		if(template === "basic") {
			const root = path.resolve(projectName);
			const appName = path.basename(root);

			//Make sure the name provided is following npm package nomenclature
			checkAppName(appName);
			fs.ensureDirSync(projectName);

			console.log(`\nCreating your Webiny app in ${chalk.green(root)}.\n`);

			const packageJson = {
				name: appName,
				version: "0.1.0",
				private: true,
			};
			//prettifies the package.json
			fs.writeFileSync(
				path.join(root, "package.json"),
				JSON.stringify(packageJson, null, 2) + os.EOL
			);

			run(root, appName, template);
		} else {
			console.log("Invalid template name, we currently support 'basic'.");
		}
	}
}

function informationHandler() {
	console.log(chalk.bold("\nEnvironment Info:"));
	console.log(
		`\n  current version of ${packageJson.name}: ${packageJson.version}`
	);
	console.log(`  running from ${__dirname}`);
	return envinfo
		.run(
			{
				System: ["OS", "CPU"],
				Binaries: ["Node", "npm", "Yarn"],
				Browsers: ["Chrome", "Edge", "Internet Explorer", "Firefox", "Safari"],
				npmGlobalPackages: ["create-webiny-project"],
			},
			{
				duplicates: true,
				showNotFound: true,
			}
		)
		.then(console.log);    
}

async function install(root, dependencies) {
	const command = "yarnpkg";
	const args = ["add", "--exact"];
  	[].push.apply(args, dependencies);
	args.push("--cwd");
	args.push(root);
	await execa(command, args, { stdio: "inherit" });
	return;
}

async function run(root, appName, template) {
	const allDependencies = [];
	try {
		const templateName = "cwp-template-" + template ;

		allDependencies.push(templateName);
		
		console.log("Installing packages. This might take a couple of minutes.");
		
		await install(root, allDependencies);

		await init(root, appName, templateName);
	} catch(reason) {
		console.log("\nAborting installation.");
		if (reason.command) {
			console.log(`  ${chalk.cyan(reason.command)} has failed.`);
		} else {
			console.log(chalk.red("Unexpected error. Please report it as a bug:"));
			console.log(reason);
		}
		console.log("\nDone.");
		process.exit(1);
	}
}