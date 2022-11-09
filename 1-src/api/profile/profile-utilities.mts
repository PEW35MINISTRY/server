import { GenderEnum, ProfileEditRequest, ProfilePartnerResponse, ProfilePublicResponse, ProfileResponse, RoleEnum, StageEnum } from "./profile-types.mjs";
import database, {query, queryAll, queryTest, TestResult} from '../../services/database.mjs';
import { Exception } from "../api-types.mjs";
import * as log from '../../services/log.mjs';
import { User_TYPE } from "../../services/database-types.mjs";

export const getPublicProfile = async(userId: number):Promise<ProfilePublicResponse> => {
    //Database Query    
    const user:User_TYPE = await query("SELECT * FROM user_table WHERE user_id = $1;", [userId]);

    return {
        userId: user.user_id, 
        userRole: user.user_role, 
        displayName: user.display_name, 
        dob: user.dob,
        gender: user.gender,
        circleList: [],
        proximity: 0,
        profileImage: user.profile_image,
    };
}

export const getProfile = async(userId: number):Promise<ProfileResponse> => {
    //Database Query
    const user:User_TYPE = await query("SELECT * FROM user_table WHERE user_id = $1;", [userId]);

    return {
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
    };
}

export const getPartnerProfile = async (userId: number, partnerId: number):Promise<ProfilePartnerResponse> => {
    //Database Query
    const partner:User_TYPE = await query("SELECT * FROM user_table WHERE user_id = $1;", [partnerId]);

    if(partner.partners.includes(userId)) {     

        return {
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
        };
    } else 
        new Exception(401, `Requested User ${partnerId} is not a Partner of ${userId}.`);
}

/******************
 * Edit Profile by Authorization
 * NOTE: requestorId is user requesting edit on userId
 */
export const getPasswordHash = async (password:string):Promise<string> => {
    return 'hashed_password';
}

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

export const isProfileEditAllowed = async(userId: number, requestorId?: number):Promise<boolean> => {
    //TODO: add column circleId to leader Table
    const requestorRoleAndCircle = await query("SELECT user_role FROM user_table WHERE user_id = $1;", [requestorId]);

    if(userId === requestorId || requestorRoleAndCircle.user_role === RoleEnum.ADMIN) return true;

    //Test Member of Leader's Circle
    if(requestorRoleAndCircle.user_role === RoleEnum.LEADER) {
        // const userCircleList = await query("SELECT circleList FROM user_table WHERE user_id = $1;", [userId]);
        // if(userCircleList.includes(requestorRoleAndCircle.circleId))
            return true;
    }
    return false;
}

export const editProfile = async(userId: number, httpRequest:ProfileEditRequest, role?:RoleEnum):Promise<TestResult> => {
         let columns:string = '';
        let valueList:any[] = [];
        const fields = Object.entries(httpRequest.body);
    
        //Only list Fields Student can Edit
        fields.forEach((field, index) => { 
            try {
                if(role && role === RoleEnum.ADMIN) 
                    getAdminProfileChanges(userId, field, columns, valueList);
                 else 
                    getProfileChanges(userId, field, columns, valueList);                

                    if(columns && (typeof columns[columns.length-1] === 'string')){ //Only adding formatting if valid field
                        columns += ` = $${valueList.length}${index == fields.length-1 ? '' : ','} `; //Remove trailing comma        
                    }  
                
                }catch(error){log.error('User Edit Profile Error: ', userId, error);
                    return { success: false, result: {columns, valueList}, error: error};
                }
        });
    
        return await queryTest(`UPDATE user_table SET ${columns} WHERE user_id = $${valueList.length+1};`, [...valueList, userId]);
    }

//Student or Relevant Leader
    const getProfileChanges = (userId:number, field:[string,unknown], columns:string, valueList:any[], logWarn:boolean=true):boolean => {
        //General Edits
        if( checkField('displayName', `display_name`, field[1], field[0], columns, valueList)
            || checkField('dob', `dob`, parseInt(field[1] as string), field[0], columns, valueList)
            || checkField('gender', `gender`, GenderEnum[field[1] as string], field[0], columns, valueList)
            || checkField('zipcode', `zipcode`, field[1], field[0], columns, valueList)
            || checkField('stage', `stage`, StageEnum[field[1] as string], field[0], columns, valueList)
            || checkField('dailyNotificationHour', `dailyNotificationHour`, parseInt(field[1] as string), field[0], columns, valueList)
            || checkField('circleList', `circles`, field[1], field[0], columns, valueList)
            || checkField('profileImage', `profile_image`, field[1], field[0], columns, valueList)

        ) return true;
        if(logWarn) log.warn("User Editing Profile:", userId, "Unmatched Field: ", field);
        return false;
    }

    //Note: userId is profile being changed; admin already authenticated in route
    const getAdminProfileChanges = (userId:number, field:[string,unknown], columns:string, valueList:any[], logWarn:boolean=true) => {
        //General Edits
        if( getProfileChanges(userId, field, columns, valueList, false)
        //Additional Admin Edits
            || checkField('userRole', `user_role`, RoleEnum[field[1] as string], field[0], columns, valueList)
            || checkField('email', `email`, field[1], field[0], columns, valueList)
            || checkField('phone', `phone`, field[1], field[0], columns, valueList)
            || checkField('password', `password_hash`, getPasswordHash(field[1] as string), field[0], columns, valueList)
            || checkField('verified', `verified`, (/true/i).test(field[1] as string), field[0], columns, valueList)
            || checkField('partnerList', `partners`, field[1], field[0], columns, valueList)
            || checkField('notes', `notes`, parseInt(field[1] as string), field[0], columns, valueList)

        ) return true;
        if(logWarn) log.warn("Admin Editing Profile:", userId, "Unmatched Field: ", field);
        return false;
    }

    const checkField = (jsonProperty:string, dbColumn:string, parsedValue:any, fieldName:string, columns:string, valueList:any[]):boolean => {
        if(fieldName == jsonProperty){
            columns += dbColumn;
            valueList.push(parsedValue);
            return true;
        } return false;
    }


