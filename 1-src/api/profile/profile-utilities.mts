import { editProfileFieldAllowed, GenderEnum, getDatabaseDefaultProfileFields, ProfileEditRequest, ProfilePartnerResponse, ProfilePublicResponse, ProfileResponse, RoleEnum, signupProfileFieldAllowed, StageEnum } from "./profile-types.mjs";
import database, {formatTestResult, query, queryAll, queryTest, TestResult} from "../../services/database/database.mjs";
import { Exception } from "../api-types.mjs";
import * as log from '../../services/log.mjs';
import { DB_USER } from "../../services/database/database-types.mjs";
import { getPasswordHash } from "../auth/auth-utilities.mjs";
import { SignupRequest } from "../auth/auth-types.mjs";

export const formatPublicProfile = (user: DB_USER):ProfilePublicResponse =>  ({
        userId: user.user_id, 
        userRole: user.user_role, 
        displayName: user.display_name, 
        dob: user.dob,
        gender: user.gender,
        circleList: [],
        proximity: 0,
        profileImage: user.profile_image,
    });

export const getPublicProfile = async(userId: number):Promise<ProfilePublicResponse> => {
    //Database Query    
    const user:DB_USER = await query("SELECT * FROM user_table WHERE user_id = $1;", [userId]);

    return formatPublicProfile(user);
}

export const formatProfile = (user: DB_USER):ProfileResponse =>  ({
        userId: user.user_id, 
        userRole: user.user_role, 
        displayName: user.display_name, 
        firstName: user.display_name, 
        lastName: user.display_name, 
        dob: user.dob,
        gender: user.gender,
        circleList: [],
        profileImage: user.profile_image,
        email: user.email,
        phone: user.phone,
        zipcode: user.zipcode,
        stage: user.stage,
        dailyNotificationHour: user.daily_notification_hour,
    });

export const getProfile = async(userId: number):Promise<ProfileResponse> => {
    //Database Query
    const user:DB_USER = await query("SELECT * FROM user_table WHERE user_id = $1;", [userId]);

    return formatProfile(user);
}

export const formatPartnerProfile = (partner:DB_USER):ProfilePartnerResponse => ({
            userId: partner.user_id, 
            userRole: partner.user_role, 
            displayName: partner.display_name, 
            dob: partner.dob,
            gender: partner.gender,
            circleList: [],
            zipcode: partner.zipcode,
            proximity: 0,
            stage: partner.stage,
            dailyNotificationHour: partner.daily_notification_hour,
            pendingPrayerRequestList: [],
            answeredPrayerRequestList: [],
            messageList: [],
            profileImage: partner.profile_image,
        });

export const getPartnerProfile = async (userId: number, requestorId: number):Promise<ProfilePartnerResponse> => {
    //Database Query
    const partner:DB_USER = await query("SELECT * FROM user_table WHERE user_id = $1;", [userId]);

    if(partner.partners.includes(requestorId))  
        return formatPartnerProfile(partner);

     else 
        new Exception(401, `Requested User ${userId} is not a Partner of ${requestorId}.`);
}

/******************
 * Edit Profile by Authorization
 * NOTE: requestorId is user requesting edit on userId
 */

export type roleListResult = 
    {
        userId: number,
        userRole: RoleEnum,
    };

export const getProfileRoles = async(...idList: number[]):Promise<roleListResult[]> => {
    let result:roleListResult[] = [];

    idList.forEach(async (id) => {
        const role = await query("SELECT user_role FROM user_table WHERE user_id = $1;", [id]);
        result.push({userId: id, userRole: RoleEnum[role as string] as RoleEnum});
    });

    return result;
}

export enum EDIT_TYPES {
    EDIT,
    CREATE
}

export const editProfile = async(editId: number, httpRequest:ProfileEditRequest | SignupRequest, accessorUserRole:RoleEnum, editType:EDIT_TYPES = EDIT_TYPES.EDIT):Promise<TestResult> => {
        let columnList:string[] = [];
        let valueList:any[] = [];
        const fields = Object.entries(httpRequest.body);

        if(editType === EDIT_TYPES.CREATE) {
            columnList=[...getDatabaseDefaultProfileFields().keys()];
            valueList=[...getDatabaseDefaultProfileFields().values()]
        }
    
        //Only list Fields Student can Edit
        fields.forEach((field, index) => { 
            try {
                if(!getProfileChanges(editId, field, columnList, valueList, accessorUserRole, editType))
                log.warn("User Editing Profile: Unmatched Field: ", field);              
            
            }catch(error){log.error('User Edit Profile Error: ', editId, error);
                return { success: false, result: {columnList, valueList}, error: error};
            }
        });

        if(!columnList.length || !valueList.length)
            return formatTestResult(false, null, 'Invalid Profile Edit Request', columnList.toString(), valueList.toString())
        else if(editType === EDIT_TYPES.CREATE)
            return await queryTest(`INSERT INTO user_table (${columnList.join(', ')}) VALUES (${valueList.map((v,i)=>`\$${i+1}`).join(', ')});`, [...valueList]);
        else if(editType === EDIT_TYPES.EDIT)
            return await queryTest(`UPDATE user_table SET ${columnList.join(', ')} WHERE user_id = $${valueList.length+1};`, [...valueList, editId]);
    }

//Student or Relevant Leader
    const getProfileChanges = (editId:number, field:[string, unknown], columnList:string[], valueList:any[], accessorUserRole:RoleEnum, editType:EDIT_TYPES = EDIT_TYPES.EDIT):boolean => {
               
        //Special Parsing Edits 
        if( ((editType === EDIT_TYPES.CREATE && signupProfileFieldAllowed(field[0], accessorUserRole))
            || (editType === EDIT_TYPES.EDIT && editProfileFieldAllowed(field[0], accessorUserRole))
        ) && (
            addField('email', `email`, field[1], field[0], columnList, valueList, editType)
            || addField('displayName', `display_name`, field[1], field[0], columnList, valueList, editType)
            || addField('password', `password_hash`, getPasswordHash(field[1] as string), field[0], columnList, valueList, editType)
            || (addField('userRole', `user_role`, RoleEnum[field[1] as string], field[0], columnList, valueList, editType)
                && addField('userRole', `verified`, false, field[0], columnList, valueList, editType)) //UnVerify account on role change
            // || addField('verified', `verified`, (/true/i).test(field[1] as string), field[0], columnList, valueList, editType)
            // || addField('firstName', `display_name`, field[1], field[0], columnList, valueList, editType)
            // || addField('lastName', `display_name`, field[1], field[0], columnList, valueList, editType)
            || addField('phone', `phone`, field[1], field[0], columnList, valueList, editType)
            || addField('dob', `dob`, parseInt(field[1] as string), field[0], columnList, valueList, editType)
            || addField('gender', `gender`, GenderEnum[field[1] as string], field[0], columnList, valueList, editType)                      
            || addField('zipcode', `zipcode`, field[1], field[0], columnList, valueList, editType)
            || addField('dailyNotificationHour', `daily_notification_hour`, parseInt(field[1] as string), field[0], columnList, valueList, editType)

            || addField('partnerList', `partners`, field[1], field[0], columnList, valueList, editType)
            || addField('circleList', `circles`, field[1], field[0], columnList, valueList, editType)
            || addField('profileImage', `profile_image`, field[1], field[0], columnList, valueList, editType)
                        
            || addField('stage', `stage`, StageEnum[field[1] as string], field[0], columnList, valueList, editType)
            || addField('notes', `notes`, parseInt(field[1] as string), field[0], columnList, valueList, editType)

        ))  return true;
        else
            return false;
    }

    //TODO: Account Verify Email Send

    const addField = (jsonProperty:string, dbColumn:string, parsedValue:any, fieldName:string, columnList:string[], valueList:any[], editType:EDIT_TYPES = EDIT_TYPES.EDIT):boolean => {
        
        if(fieldName == jsonProperty && parsedValue != null){
            //Update Field
            if(editType === EDIT_TYPES.EDIT) {
            
                if(columnList.includes(`${dbColumn} = \$${valueList.length}`)){ //Replaces Duplicates
                    const index:number = columnList.indexOf(`${dbColumn} = \$${valueList.length}`);
                    valueList[index] = parsedValue;
                    return true;

                } else { //Add New
                    valueList.push(parsedValue);
                    columnList.push(`${dbColumn} = \$${valueList.length}`);
                    return true;
                }

            //Insert Field
            } else if(editType === EDIT_TYPES.CREATE) {

                if(columnList.includes(dbColumn)){ //Replaces Duplicates
                    const index:number = columnList.indexOf(dbColumn);
                    valueList[index] = parsedValue;
                    return true;

                } else { //Add New
                    valueList.push(parsedValue);
                    columnList.push(dbColumn);
                    return true;
                }
            }
        } return false;
    }