import { GenderEnum, ProfileEditRequest, ProfilePartnerResponse, ProfilePublicResponse, ProfileResponse, RoleEnum, StageEnum } from "./profile-types.mjs";
import database, {formatTestResult, query, queryAll, queryTest, TestResult} from '../../services/database.mjs';
import { Exception } from "../api-types.mjs";
import * as log from '../../services/log.mjs';
import { DB_USER } from "../../services/database-types.mjs";
import { getPasswordHash } from "../auth/auth-utilities.mjs";
import { SignupRequest } from "../auth/auth-types.mjs";

export const formatPublicProfile = (user: DB_USER):ProfilePublicResponse => 
    ({
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

export const formatProfile = (user: DB_USER):ProfileResponse => 
    ({
        userId: user.user_id, 
        userRole: user.user_role, 
        displayName: user.display_name, 
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

export const formatPartnerProfile = (partner:DB_USER):ProfilePartnerResponse =>
         ({
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


export const editProfile = async(userId: number, httpRequest:ProfileEditRequest | SignupRequest, role?:RoleEnum, newProfile?:boolean):Promise<TestResult> => {
        let columnList:string[] = [];
        let valueList:any[] = [];
        const fields = Object.entries(httpRequest.body);
    
        //Only list Fields Student can Edit
        fields.forEach((field, index) => { 
            try {
                if(newProfile) 
                    getSignupChanges(field, columnList, valueList);
                else if(role && role === RoleEnum.ADMIN) 
                    getAdminProfileChanges(userId, field, columnList, valueList);
                 else 
                    getProfileChanges(userId, field, columnList, valueList);                
                
                }catch(error){log.error('User Edit Profile Error: ', userId, error);
                    return { success: false, result: {columnList, valueList}, error: error};
                }
        });

        if(!columnList.length || !valueList.length)
            return formatTestResult(false, null, 'Invalid Profile Edit Request', columnList.toString(), valueList.toString())
        else if(newProfile)
            return await queryTest(`INSERT INTO user_table ${columnList.join(', ')};`, [...valueList, userId]);
        else
            return await queryTest(`UPDATE user_table SET ${columnList.join(', ')} WHERE user_id = $${valueList.length+1};`, [...valueList, userId]);
    }

//Student or Relevant Leader
    const getProfileChanges = (userId:number, field:[string,unknown], columnList:string[], valueList:any[], logWarn:boolean=true):boolean => {
        //General Edits
        if( checkField('displayName', `display_name`, field[1], field[0], columnList, valueList)
            || checkField('dob', `dob`, parseInt(field[1] as string), field[0], columnList, valueList)
            || checkField('gender', `gender`, GenderEnum[field[1] as string], field[0], columnList, valueList)
            || checkField('zipcode', `zipcode`, field[1], field[0], columnList, valueList)
            || checkField('stage', `stage`, StageEnum[field[1] as string], field[0], columnList, valueList)
            || checkField('dailyNotificationHour', `dailyNotificationHour`, parseInt(field[1] as string), field[0], columnList, valueList)
            || checkField('circleList', `circles`, field[1], field[0], columnList, valueList)
            || checkField('profileImage', `profile_image`, field[1], field[0], columnList, valueList)

        ) return true;
        if(logWarn) log.warn("Creating User:", userId, "Unmatched Field: ", field);
        return false;
    }

    //Note: userId is profile being changed; admin already authenticated in route
    const getAdminProfileChanges = (userId:number, field:[string,unknown], columnList:string[], valueList:any[], logWarn:boolean=true) => {
        //General Edits
        if( getProfileChanges(userId, field, columnList, valueList, false)
        //Additional Admin Edits
            || (checkField('userRole', `user_role`, RoleEnum[field[1] as string], field[0], columnList, valueList)
                && checkField('userRole', `verified`, false, field[0], columnList, valueList)) //UnVerify account on role change
            || checkField('verified', `verified`, (/true/i).test(field[1] as string), field[0], columnList, valueList)
            || checkField('email', `email`, field[1], field[0], columnList, valueList)
            || checkField('phone', `phone`, field[1], field[0], columnList, valueList)
            || checkField('password', `password_hash`, getPasswordHash(field[1] as string), field[0], columnList, valueList)
            || checkField('verified', `verified`, (/true/i).test(field[1] as string), field[0], columnList, valueList)
            || checkField('partnerList', `partners`, field[1], field[0], columnList, valueList)
            || checkField('notes', `notes`, parseInt(field[1] as string), field[0], columnList, valueList)

        ) return true;
        if(logWarn) log.warn("Admin Editing Profile:", userId, "Unmatched Field: ", field);
        return false;
    }

    //INITIAL SIGNUP
    const getSignupChanges = (field:[string,unknown], columnList:string[], valueList:any[], logWarn:boolean=true):boolean => {
        //General Edits
        if( checkField('userRole', `user_role`, RoleEnum[field[1] as string], field[0] == 'LEADER' ? RoleEnum.LEADER : RoleEnum.STUDENT, columnList, valueList) //Only Student or Leader Initially
            || checkField('email', `email`, field[1], field[0], columnList, valueList)
            || checkField('phone', `phone`, field[1], field[0], columnList, valueList)
            || checkField('password', `password_hash`, getPasswordHash(field[1] as string), field[0], columnList, valueList)
            || checkField('displayName', `display_name`, field[1], field[0], columnList, valueList)
            || checkField('dob', `dob`, parseInt(field[1] as string), field[0], columnList, valueList)
            || checkField('gender', `gender`, GenderEnum[field[1] as string], field[0], columnList, valueList)
            || checkField('zipcode', `zipcode`, field[1], field[0], columnList, valueList)
            || checkField('stage', `stage`, StageEnum[field[1] as string], field[0], columnList, valueList)
            || checkField('dailyNotificationHour', `dailyNotificationHour`, parseInt(field[1] as string), field[0], columnList, valueList)
            || checkField('profileImage', `profile_image`, field[1], field[0], columnList, valueList)

        ) return true;
        if(logWarn) log.warn("User Editing Profile: Unmatched Field: ", field);
        return false;
    }

    const checkField = (jsonProperty:string, dbColumn:string, parsedValue:any, fieldName:string, columnList:string[], valueList:any[]):boolean => {
        if(fieldName == jsonProperty && parsedValue != null){

            if(columnList.includes(`${dbColumn} = \$${valueList.length}`)){
                const index:number = columnList.indexOf(`${dbColumn} = \$${valueList.length}`);
                valueList[index] = parsedValue;
                return true;

            } else { //Add New
                valueList.push(parsedValue);
                columnList.push(`${dbColumn} = \$${valueList.length}`);
                return true;
            }
        } return false;
    }


