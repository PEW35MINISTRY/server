
import { Environment, GetFunctionConfigurationCommand, LambdaClient, UpdateFunctionConfigurationCommand } from '@aws-sdk/client-lambda';
import dotenv from 'dotenv';
import * as log from '../2-services/10-utilities/logging/log.mjs';

const envMap = dotenv.config();

const updateLambdaENV = async () => {
    
    try {
        const client = new LambdaClient({region: process.env.LAMBDA_REGION});

        const response = await client.send(new UpdateFunctionConfigurationCommand({
            FunctionName: process.env.LAMBDA_NAME,
            Environment: { Variables: envMap.parsed ?? {}}
        }))

    } catch (error) {
        await log.alert(`SERVER | Client failed to update Lambda ENV variables in Region: ${process.env.LAMBDA_REGION}.`, error, error.message)
        throw error;
    }
}

await updateLambdaENV();