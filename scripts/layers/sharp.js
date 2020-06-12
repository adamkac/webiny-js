const path = require("path");
const execa = require("execa");
const writeJson = require("write-json-file");
const regions = require("./regions");

const LAYER_NAME = "webiny-v4-sharp";

(async () => {
    process.env.AWS_PROFILE = "webiny";
    const layersPath = path.join(__dirname, "layers.json");
    const layers = require(layersPath);
    try {
        for (let i = 0; i < regions.length; i++) {
            const region = regions[i];
            try {
                console.log(`Creating layer ${LAYER_NAME} in ${region}...`);
                // Create layer
                const { stdout } = await execa("aws", [
                    "lambda",
                    "publish-layer-version",
                    "--layer-name",
                    LAYER_NAME,
                    "--description",
                    "Sharp dependency for image transformation",
                    "--zip-file",
                    "fileb://" + path.join(__dirname, "sharp", "layer.zip"),
                    "--compatible-runtimes",
                    "nodejs10.x",
                    "nodejs12.x",
                    "--region",
                    region,
                    "--cli-read-timeout",
                    "0",
                    "--cli-connect-timeout",
                    "0",
                    "--output",
                    "json"
                ]);

                const layer = JSON.parse(stdout);

                console.log(`Created`, layer.LayerVersionArn);

                await execa("aws", [
                    "lambda",
                    "add-layer-version-permission",
                    "--layer-name",
                    LAYER_NAME,
                    "--statement-id",
                    "public",
                    "--action",
                    "lambda:GetLayerVersion",
                    "--principal",
                    "*",
                    "--version-number",
                    layer.Version,
                    "--region",
                    region
                ]);

                layers[LAYER_NAME] = layers[LAYER_NAME] || {};
                layers[LAYER_NAME][region] = layer.LayerVersionArn;

                console.log("");
            } catch (err) {
                console.log(`Error in region: ${region}`);
                console.log(err.message);
                console.log("");
            }
        }
    } finally {
        console.log("Layers", JSON.stringify(layers, null, 2));
        await writeJson(layersPath, layers);
    }
})();
