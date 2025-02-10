const { DefaultAzureCredential } = require("@azure/identity");
const { ResourceManagementClient } = require("@azure/arm-resources");
const { v4: uuidv4 } = require('uuid');

const subscriptionId = "00000000-0000-0000-0000-000000000000";
const resourceGroupName = "rg-fntest02";
const hostingPlanName = "plan-fntest02";
const functionAppName = "fn-fntest02";

const credential = new DefaultAzureCredential();
const client = new ResourceManagementClient(credential, subscriptionId);

// create an Azure Function App
async function createFunctionApp() {
    const deploymentName = `functionAppDeployment-${uuidv4()}`;
    const template = require("./template.json");

    const deploymentParameters = {
        properties: {
            mode: "Incremental",
            template: template,
            parameters: {
                appName: {
                    value: functionAppName
                },
                hostingPlanName: {
                    value: hostingPlanName
                },
            },
        },
    };

    try {
        const deployment = await client.deployments.beginCreateOrUpdate(
            resourceGroupName,
            deploymentName,
            deploymentParameters
        );

        console.log("Deployment started");

        // Wait for the deployment to finish
        const deploymentResult = await deployment.pollUntilDone();

        console.log("Deployment result:", deploymentResult);
    } catch (error) {
        console.error("Deployment failed:", error.response?.data || error.message);
        throw error;
    }
}

// Deploy the code in HttpTrigger1 folder to the Azure Function App, using zip deployment
async function deployFunctionApp() {
    const fs = require("fs");
    const path = require("path");
    const axios = require("axios"); // Make sure to npm install axios

    // assumes an exisitng ZIP, but you could also create one
    const zipFilePath = path.join(__dirname, "HttpTrigger1.zip");
    const zipFile = fs.readFileSync(zipFilePath);

    // Get token from DefaultAzureCredential
    const credential = new DefaultAzureCredential();
    const token = await credential.getToken("https://management.azure.com/.default");

    // Kudu API URL for zip deployment
    const kuduApiUrl = `https://${functionAppName}.scm.azurewebsites.net/api/zipdeploy`;

    // Try deploying the zip file
    try {
        const response = await axios.post(kuduApiUrl, zipFile, {
            headers: {
                'Authorization': `Bearer ${token.token}`,
                'Content-Type': 'application/zip',
                'Content-Length': zipFile.length
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        console.log('Deployment successful:', response.status);
        return response.data;
    } catch (error) {
        console.error('Deployment failed:', error.response?.data || error.message);
        throw error;
    }
}

// call the create function app, and then the deploy function app
createFunctionApp().then(() => {
    deployFunctionApp().then(() => {
        console.log("Done");
    });
});