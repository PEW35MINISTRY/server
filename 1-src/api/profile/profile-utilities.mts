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

export const editProfile = async(userId: number, httpRequest:ProfileEditRequest, role?:RoleEnum, requestorId?: number):Promise<TestResult> => {
         let setColumn:string = '';
        let setParameter:any[] = [];
        const fields = Object.entries(httpRequest.body);
    
        //Only list Fields Student can Edit
        fields.forEach((field, index) => { 
            try {
                if(role && role === RoleEnum.ADMIN) {
                    if(!getAdminProfileChanges(userId, field, setColumn, setParameter))
                        log.warn("User Editing Profile:", userId, "Unmatched Field: ", field);
                } else {
                    if(!getProfileChanges(userId, field, setColumn, setParameter))
                        log.warn("Admin: ", requestorId, "Editing Profile:", userId, "Unmatched Field: ", field);
                }

                    if(setColumn && (typeof setColumn[setColumn.length-1] === 'string')){ //Only adding formatting if valid field
                    setColumn += ` = $${setParameter.length}${index == fields.length-1 ? '' : ','} `; //Remove trailing comma        
                }  
                
            }catch(error){log.error('User Edit Profile Error: ', userId, error);
                return { success: false, result: {setColumn, setParameter}, error: error};
            }
        });
    
        return await queryTest(`UPDATE user_table SET ${setColumn} WHERE user_id = $${setParameter.length+1};`, [...setParameter, userId]);
    }

//Student or Relevant Leader
    const getProfileChanges = (userId:number, field:[string,unknown], setColumn:string, setParameter:any[]):boolean => {
        if(field[0] == "displayName"){      //JSON Name
            setColumn += `display_name`;    //DatabaseName
            setParameter.push(field[1]);    //New Value
        } else if(field[0] == "dob"){
            setColumn += `dob`;
            setParameter.push(parseInt(field[1] as string));
        } else if(field[0] == "gender"){
            setColumn += `gender`;
            setParameter.push(GenderEnum[field[1] as string]);
        } else if(field[0] == "zipcode"){
            setColumn += `zipcode`;
            setParameter.push(field[1]);
        } else if(field[0] == "stage"){
            setColumn += `stage`;
            setParameter.push(StageEnum[field[1] as string]);
        } else if(field[0] == "dailyNotificationHour"){
            setColumn += `daily_notification_hour`;
            setParameter.push(parseInt(field[1] as string));
        } else if(field[0] == "circleList"){
            setColumn += `circles`;
            setParameter.push(field[1]);
        } else if(field[0] == "profileImage"){
            setColumn += `profile_image`;
            setParameter.push(parseInt(field[1] as string));
        } else {
           return false;
        }
        return true;
    }

    //Note: userId is profile being changed; admin already authenticated in route
    const getAdminProfileChanges = (userId:number, field:[string,unknown], setColumn:string, setParameter:any[]) => {
        //General Edits
        if(getProfileChanges(userId, field, setColumn, setParameter)){
            return true;

        //Additional Admin Edits
        } else if(field[0] == "userRole"){
            setColumn += `user_role`;
            setParameter.push(RoleEnum[field[1] as string]);
        } else if(field[0] == "email"){
            setColumn += `email`;
            setParameter.push(field[1]);
        } else if(field[0] == "phone"){
            setColumn += `phone`;
            setParameter.push(field[1]);
        } else if(field[0] == "password"){
            setColumn += `password_hash`;
            setParameter.push(getPasswordHash(field[1] as string));
        } else if(field[0] == "verified"){
            setColumn += `verified`;
            setParameter.push((/true/i).test(field[1] as string));
        } else if(field[0] == "partnerList"){
            setColumn += `partners`;
            setParameter.push(field[1]);
        } else if(field[0] == "notes"){
            setColumn += `notes`;
            setParameter.push(parseInt(field[1] as string));
        } else {
            return false;
         }
         return true;
    }


