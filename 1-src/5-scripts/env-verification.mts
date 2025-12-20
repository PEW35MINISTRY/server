import { ENVIRONMENT_TYPE } from '../0-assets/field-sync/input-config-sync/inputField.mjs';
import { getEnvExists, getEnvironment } from '../2-services/10-utilities/env-utilities.mjs';

enum Requirement {
    REQUIRED = 'REQUIRED',
    RECOMMENDED = 'RECOMMENDED',
    OPTIONAL = 'OPTIONAL',
    DEPRECATED = 'DEPRECATED'
}

type RequirementConfiguration=Partial<Record<ENVIRONMENT_TYPE, Requirement>>;

interface EnvDefinition {
    requirement?:Requirement | RequirementConfiguration, //Defaults REQUIRED
    dependent?:string[],
    description?:string
}

/* Only need to include environment variables where default is not provided */
const REQUIRED_ENV_CONFIGURATION:Record<string, EnvDefinition> = {
    TZ: {
        requirement: {
            [ENVIRONMENT_TYPE.DEVELOPMENT]: Requirement.RECOMMENDED,
            [ENVIRONMENT_TYPE.PRODUCTION]: Requirement.RECOMMENDED
        }
    },

    ENABLE_CRON: {
        requirement: {
            [ENVIRONMENT_TYPE.DEVELOPMENT]: Requirement.RECOMMENDED,
            [ENVIRONMENT_TYPE.PRODUCTION]: Requirement.RECOMMENDED
        }
    },

    SERVER_PORT: {
        requirement: Requirement.REQUIRED,
        dependent: ['SERVER_PATH', 'ASSET_URL', 'ENVIRONMENT_BASE_URL']
    },

    DEFAULT_MODEL_SOURCE_ENVIRONMENT: {
        requirement: Requirement.REQUIRED
    },

    //JWT SECRET KEY TOKEN
    JWT_SECRET_NAME: {
        requirement: {
            [ENVIRONMENT_TYPE.PRODUCTION]: Requirement.REQUIRED
        },
        dependent: ['JWT_SECRET_REGION']
    },
    SECRET_KEY: {
        requirement: {
            [ENVIRONMENT_TYPE.LOCAL]: Requirement.RECOMMENDED,
            [ENVIRONMENT_TYPE.DEVELOPMENT]: Requirement.REQUIRED
        },
    },
    JWT_DURATION: {
        requirement: Requirement.RECOMMENDED
    },

    //RDS DATABASE
    RDS_SECRET_NAME: {
        requirement: {
            [ENVIRONMENT_TYPE.PRODUCTION]: Requirement.REQUIRED
        },
        dependent: ['RDS_SECRET_REGION']
    },
    DATABASE_END_POINT: {
        requirement: Requirement.REQUIRED,
        dependent: ['DATABASE_NAME']
    },
    DATABASE_USER: {
        requirement: {
            [ENVIRONMENT_TYPE.LOCAL]: Requirement.RECOMMENDED
        },
         dependent: ['DATABASE_PASSWORD']
    },

    IMAGE_BUCKET_NAME: {
        requirement: Requirement.REQUIRED,
        dependent: ['IMAGE_BUCKET_REGION', 'IMAGE_BUCKET_KEY']
    },

    //LOG SETTINGS
    SAVE_LOGS_LOCALLY: {
        requirement: Requirement.RECOMMENDED
    },
    UPLOAD_LOGS_S3: {
        requirement: {
            [ENVIRONMENT_TYPE.DEVELOPMENT]: Requirement.RECOMMENDED,
            [ENVIRONMENT_TYPE.PRODUCTION]: Requirement.RECOMMENDED
        },
        dependent: ['LOG_BUCKET_REGION', 'LOG_BUCKET_NAME']
    },
    LOG_ATHENA_DATABASE: {
        requirement: Requirement.RECOMMENDED,
        dependent: ['LOG_BUCKET_REGION', 'LOG_BUCKET_NAME', 'ATHENA_REGION', 'LOG_ATHENA_TABLE']
    },
    SEND_LOG_EMAILS: {
        requirement: {
            [ENVIRONMENT_TYPE.DEVELOPMENT]: Requirement.RECOMMENDED,
            [ENVIRONMENT_TYPE.PRODUCTION]: Requirement.RECOMMENDED
        },
        dependent: ['SEND_EMAILS']
    },

    //EMAIL CONTROLS
    SEND_EMAILS: {
        requirement: {
            [ENVIRONMENT_TYPE.DEVELOPMENT]: Requirement.RECOMMENDED,
            [ENVIRONMENT_TYPE.PRODUCTION]: Requirement.RECOMMENDED
        },
        dependent: ['EMAIL_SES_REGION', 'EMAIL_DOMAIN']
    },

    //Notifications
    SNS_REGION: {
        requirement: Requirement.RECOMMENDED
    },
    FIREBASE_PLATFORM_APPLICATION_ARN: {
        requirement: {
            [ENVIRONMENT_TYPE.PRODUCTION]: Requirement.REQUIRED
        }
    },
    APNS_PROD_PLATFORM_APPLICATION_ARN: {
        requirement: {
            [ENVIRONMENT_TYPE.PRODUCTION]: Requirement.REQUIRED
        }
    },
    APNS_DEV_PLATFORM_APPLICATION_ARN: {
        requirement: {
            [ENVIRONMENT_TYPE.DEVELOPMENT]: Requirement.RECOMMENDED
        }
    },

    //LAMBDA MANAGEMENT
    LAMBDA_NAME: {
         requirement: {
            [ENVIRONMENT_TYPE.PRODUCTION]: Requirement.RECOMMENDED
        },
        dependent: ['LAMBDA_REGION']
    },
}


/***********************************************************
 * Validate Environment Variables Existence & Dependencies *
 * Executed in env.mts initialization                      *
 ***********************************************************/
const verifyEnvironmentVariables = ():boolean => {
    
    const environment:ENVIRONMENT_TYPE|undefined = getEnvironment();
    if(environment === undefined)
        throw new Error(`ENV Validation FAILED - Missing ENVIRONMENT variable: ${environment}`);

    let isValid:boolean = true;
    for(const [variableName, definition] of Object.entries(REQUIRED_ENV_CONFIGURATION)) {
        const value:string | undefined = getEnvExists(variableName);
        const requirement:Requirement = resolveRequirement(definition.requirement, environment);
        const dependents:string[] = definition.dependent ?? [];

        if(requirement === Requirement.REQUIRED && value === undefined) {
            console.error(`[REQUIRED] Missing Env: ${variableName}${definition.description ? ` - ${definition.description}` : ''}`);
            isValid = false;

        } else if(requirement === Requirement.RECOMMENDED && value === undefined)
            console.warn(`[RECOMMENDED] Missing Env: ${variableName}${definition.description ? ` - ${definition.description}` : ''}`);

        //Dependents are therefore required
        for(const dependentName of dependents) {
            const dependentValue:string | undefined = getEnvExists(dependentName);
            if(dependentValue === undefined || dependentValue.toLowerCase() === 'false') { //Boolean cannot be false
                console.error(`[DEPENDENT] Missing Env: ${variableName} is set, so ${dependentName} must also be set${definition.description ? `\n${variableName}: ${definition.description}` : ''}`);
                isValid = false;
            }
        }
    }

    return isValid;
}

export default verifyEnvironmentVariables;


const resolveRequirement=(requirement:Requirement | RequirementConfiguration | undefined, environment:ENVIRONMENT_TYPE):Requirement => {
    if(requirement === undefined)
        return Requirement.REQUIRED;

    if(typeof requirement === 'string')
        return requirement;

    return requirement[environment] ?? Requirement.OPTIONAL;
}
