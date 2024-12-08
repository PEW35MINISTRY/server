import * as log from '../logging/log.mjs';
import USER from '../../1-models/userModel.mjs'
import CIRCLE from '../../1-models/circleModel.mjs';
import CIRCLE_ANNOUNCEMENT from '../../1-models/circleAnnouncementModel.mjs';
import PRAYER_REQUEST from '../../1-models/prayerRequestModel.mjs';
import { MALE_DEMO_PROFILE_IMAGES, FEMALE_DEMO_PROFILE_IMAGES, MALE_NAMES, FEMALE_NAMES } from './mock-user-data.mjs';
import { CIRCLE_DEMO_IMAGES, CircleDetail, MOCK_CIRCLES } from './mock-circle-data.mjs';
import { MOCK_PRAYER_REQUESTS, PrayerRequestDetail } from './mock-prayer-request-data.mjs';
import { MOCK_PRAYER_REQUEST_COMMENT_MAP } from './mock-prayer-request-comment-data.mjs';
import { PrayerRequestListItem } from '../../../0-assets/field-sync/api-type-sync/prayer-request-types.mjs';
import { CircleListItem } from '../../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { NewPartnerListItem, ProfileListItem } from '../../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { getDateDaysFuture, PrayerRequestTagEnum } from '../../../0-assets/field-sync/input-config-sync/prayer-request-field-config.mjs';
import { GenderEnum, getDateYearsAgo, ModelSourceEnvironmentEnum, RoleEnum } from '../../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { generatePasswordHash } from '../../../1-api/2-auth/auth-utilities.mjs';
import { DATABASE_CIRCLE_STATUS_ENUM, DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM, DATABASE_PARTNER_STATUS_ENUM, DATABASE_USER_ROLE_ENUM } from '../../2-database/database-types.mjs';
import { DB_INSERT_CIRCLE, DB_INSERT_CIRCLE_ANNOUNCEMENT, DB_INSERT_CIRCLE_USER_STATUS,  DB_SELECT_CIRCLE_ANNOUNCEMENT_CURRENT, DB_SELECT_CIRCLE_DETAIL_BY_NAME, DB_SELECT_CIRCLE_LIST_BY_USER_SOURCE_ENVIRONMENT } from '../../2-database/queries/circle-queries.mjs';
import { DB_ASSIGN_PARTNER_STATUS, DB_SELECT_AVAILABLE_PARTNER_LIST, getPartnerID, getUserID } from '../../2-database/queries/partner-queries.mjs';
import { DB_INSERT_AND_SELECT_PRAYER_REQUEST, DB_INSERT_CIRCLE_RECIPIENT_PRAYER_REQUEST, DB_INSERT_PRAYER_REQUEST_COMMENT, DB_INSERT_USER_RECIPIENT_PRAYER_REQUEST, DB_SELECT_PRAYER_REQUEST_COMMENT_LIST, DB_SELECT_PRAYER_REQUEST_LIST_BY_USER_SOURCE_ENVIRONMENT, DB_UPDATE_INCREMENT_PRAYER_REQUEST_COMMENT_LIKE_COUNT } from '../../2-database/queries/prayer-request-queries.mjs';
import { DB_DELETE_CONTACT_CACHE_BATCH, DB_DELETE_CONTACT_CACHE_BY_CIRCLE_BATCH, DB_INSERT_USER, DB_INSERT_USER_ROLE, DB_POPULATE_USER_PROFILE, DB_SELECT_USER, DB_SELECT_USER_LIST_BY_SOURCE_ENVIRONMENT, DB_UNIQUE_USER_EXISTS, DB_UPDATE_USER } from '../../2-database/queries/user-queries.mjs';



/*******************************
* Create Mock User for Testing *
********************************/
export const createMockUser = async(populateRelations = true):Promise<USER> => {
    let user:USER = new USER();
    user.modelSourceEnvironment = ModelSourceEnvironmentEnum.MOCK;
    user.gender = ((randomRange(2) % 2) === 0) ? GenderEnum.MALE : GenderEnum.FEMALE;
    user.image = (user.gender === GenderEnum.MALE) ? MALE_DEMO_PROFILE_IMAGES[randomRange(MALE_DEMO_PROFILE_IMAGES.length)] : FEMALE_DEMO_PROFILE_IMAGES[randomRange(FEMALE_DEMO_PROFILE_IMAGES.length)];       
    user.lastName = 'Demo'
    user.passwordHash = await generatePasswordHash('password');
    user.postalCode = '55555';
    user.dateOfBirth = getDateYearsAgo(randomRange(17, 13));
    user.walkLevel = randomRange(10, 1);
    user.maxPartners = 10;
    user.notes = `Mock Profile created on ${new Date().toISOString()}`;
    
    /* Unique Credentials */
    let foundUniqueCredentials:boolean = false;
    const attemptedCredentials:string[] = [];
    for(let i = 0; i < 5; i++) {
        const suffix = randomDigits(5);
        const firstName = (user.gender === GenderEnum.MALE) ? MALE_NAMES[randomRange(MALE_NAMES.length)] : FEMALE_NAMES[randomRange(FEMALE_NAMES.length)];       

        const fieldMap:Map<string, string> = new Map([
            ['email', `${firstName.toLowerCase()}-${suffix}@encouragingprayer.org`],
            ['displayName', `${firstName.toLowerCase()}-${suffix}`]
        ]);
        attemptedCredentials.push(JSON.stringify(Object.fromEntries(fieldMap)));

        if(await DB_UNIQUE_USER_EXISTS(fieldMap, true) === false) {
            foundUniqueCredentials = true;
            user.firstName = firstName;
            user.displayName = fieldMap.get('displayName');
            user.email = fieldMap.get('email');
            break;
        }
    }

    if(foundUniqueCredentials === false) {
        log.error('Failed to generate unique credentials for a new mock user:', ...attemptedCredentials);
        return new USER(-1);
    }

    /* Save Mock User | userID assigned by Database */
    if(await DB_INSERT_USER(user.getDatabaseProperties())) {
        user = await DB_SELECT_USER(new Map([['email', user.email], ['passwordHash', user.passwordHash]]));
        log.event(`Mock Profile: ${user.userID} | '${user.displayName}' created.`);

    } else {
        log.error(`Error saving mock user '${user.displayName}'`);
        return new USER();
    }

    /* Populate Profile Connections */
    if(populateRelations)
        return await populateDemoRelations(user);
    else 
        return user;
}



/************************************
* Create Prayer Request for Testing *
*************************************/
export const createMockPrayerRequest = async(userID:number):Promise<PRAYER_REQUEST> => {
    let request:PRAYER_REQUEST = new PRAYER_REQUEST();
    request.requestorID = userID;
    const detail:PrayerRequestDetail = MOCK_PRAYER_REQUESTS[randomRange(MOCK_PRAYER_REQUESTS.length)];
    request.topic = detail.topic;
    request.description = detail.description;
    request.tagList = detail.categoryList;
    request.prayerCount = randomRange(500);
    request.isOnGoing = true;
    request.expirationDate = getDateDaysFuture(90);
    request.isValid = true;

    /* Save to get prayerRequestID */
    request = await DB_INSERT_AND_SELECT_PRAYER_REQUEST(request.getDatabaseProperties());

    if(!request.isValid || request.prayerRequestID <= 0) {
        log.warn('Error Saving Mock Prayer Request', request.toString());
        return new PRAYER_REQUEST();
    }

    /* Share with other MOCK Users */
    const userRecipients:ProfileListItem[] = await getMockUserList(3, undefined, 17);
    for(const user of userRecipients) {
        if(user.userID != userID && await DB_INSERT_USER_RECIPIENT_PRAYER_REQUEST({prayerRequestID: request.prayerRequestID, userID: user.userID})) {
            request.userRecipientList.push(user);

            /* Comments */
            const selectedCommentTopic:PrayerRequestTagEnum = request.tagList[randomRange(request.tagList.length)];
            if(MOCK_PRAYER_REQUEST_COMMENT_MAP.has(selectedCommentTopic)) {
                const comment:string = MOCK_PRAYER_REQUEST_COMMENT_MAP.get(selectedCommentTopic)[randomRange(MOCK_PRAYER_REQUEST_COMMENT_MAP.get(selectedCommentTopic).length)];
                await DB_INSERT_PRAYER_REQUEST_COMMENT({prayerRequestID: request.prayerRequestID, commenterID: user.userID, message: comment });
            }
        }
    }
    /* Comment Likes */
    request.commentList = await DB_SELECT_PRAYER_REQUEST_COMMENT_LIST(request.prayerRequestID);
    for(const comment of request.commentList) {
        comment.likeCount = randomRange(150);
        await DB_UPDATE_INCREMENT_PRAYER_REQUEST_COMMENT_LIKE_COUNT(comment.commentID, comment.likeCount);
    }


    /* Share with MOCK owned Circles */
    const circleRecipients:CircleListItem[] = await getMockCircleList(2, undefined, 15);
    for(const circle of circleRecipients) {
        if(await DB_INSERT_CIRCLE_RECIPIENT_PRAYER_REQUEST({prayerRequestID: request.prayerRequestID, circleID: circle.circleID})) {
            request.circleRecipientList.push(circle);
        }
    }

    log.event(`Mock Prayer Request: ${request.prayerRequestID} | ${request.topic} | created for user ${userID} with ${request.commentList.length} comments.`);
    return request;
}


/*********************************
* Create Mock Circle for Testing *
**********************************/
export const createMockCircle = async(leaderID:number, leaderRoleVerified:boolean = false):Promise<CIRCLE> => {
    let circle:CIRCLE = new CIRCLE();
    circle.leaderID = leaderID;
    const detail:CircleDetail = MOCK_CIRCLES[randomRange(MOCK_CIRCLES.length)];
    circle.name = detail.name;
    circle.description = detail.description;
    circle.postalCode = '55555';
    circle.image = CIRCLE_DEMO_IMAGES[randomRange(CIRCLE_DEMO_IMAGES.length)];  
    circle.notes = `Mock Circle created for leader: ${leaderID} on ${new Date().toISOString()}`;
    circle.isValid = true;

    /* Save to get circleID */
    await DB_INSERT_CIRCLE(circle.getDatabaseProperties());
    circle = await DB_SELECT_CIRCLE_DETAIL_BY_NAME(circle.leaderID, circle.name);

    if(!circle.isValid || circle.circleID <= 0) {
        log.warn('Error Saving Mock Prayer Request', circle.toString());
        return new CIRCLE();
    }

    /* Verify Circle Leader Role */
    if(!leaderRoleVerified && await DB_INSERT_USER_ROLE({userID:leaderID, userRoleList:[DATABASE_USER_ROLE_ENUM.CIRCLE_LEADER]}) === false)
        log.warn(`Creating Mock Circle ${circle.circleID}, failed fo save ${DATABASE_USER_ROLE_ENUM.CIRCLE_LEADER} Role for user: ${leaderID}`);

    /* Circle Announcements */
    const announcement:CIRCLE_ANNOUNCEMENT = new CIRCLE_ANNOUNCEMENT();
    announcement.circleID = circle.circleID;
    announcement.startDate = new Date();
    announcement.endDate = getDateDaysFuture(14);
    announcement.message = `Welcome to ${circle.name}`;

    if(await DB_INSERT_CIRCLE_ANNOUNCEMENT(announcement.getDatabaseProperties())) 
        circle.announcementList = await DB_SELECT_CIRCLE_ANNOUNCEMENT_CURRENT(circle.circleID);
    
    /* Assign Circle Members */
    const availableMembers:ProfileListItem[] = await getMockUserList(5, 11);
    for(const member of availableMembers) {
        if(member.userID != leaderID && await DB_INSERT_CIRCLE_USER_STATUS({circleID: circle.circleID, userID: member.userID, status: DATABASE_CIRCLE_STATUS_ENUM.MEMBER})) {
            circle.memberList.push(member);
        }
    }

    await DB_DELETE_CONTACT_CACHE_BATCH(circle.memberList.map(profile => profile.userID));

    log.event(`Mock Circle: ${circle.circleID} | ${circle.name} | created for leader ${leaderID} with ${circle.memberList.length} members.`);
    return circle;
}


/******************************************
* Auto Populate Profile for Demo Purposes *
*******************************************/
export const populateDemoRelations = async(user:USER):Promise<USER> => {
    if(user.userID <= 0 || !user.isValid) {
        log.warn('Error populating profile relations with invalid USER', user.userID, user.toString());
        return user;
    } else if(!user.isRole(RoleEnum.USER)) {
        log.warn('Rejected populating profile relations without USER Role', user.userID, JSON.stringify(user.userRoleList), user.toString());
    }

    const modifiedUserIDList:number[] = [user.userID];

    /* Add Partnerships */
    if(user.walkLevel === undefined) user.walkLevel = 5;  //DB default; not assigned yet on /signup
    const availablePartnerList:NewPartnerListItem[] = await DB_SELECT_AVAILABLE_PARTNER_LIST(user, 4);
    for(let i=0; i<availablePartnerList.length; i++) {
        modifiedUserIDList.push(availablePartnerList[i].userID);
        const userID:number = getUserID(user.userID, availablePartnerList[i].userID);
        const partnerID:number = getPartnerID(user.userID, availablePartnerList[i].userID);

        await DB_ASSIGN_PARTNER_STATUS(userID, partnerID, ((i % 2) === 0) ? DATABASE_PARTNER_STATUS_ENUM.PARTNER 
            : (userID === user.userID) ? DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_USER : DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_PARTNER);
    }

    for(let i=availablePartnerList.length; i<4; i++) {
        const partner:USER = await createMockUser(false);
        const modifiedPartner:USER = USER.constructByClone(partner);
        modifiedPartner.walkLevel = user.walkLevel;
        modifiedPartner.gender = user.gender;
        modifiedPartner.dateOfBirth = user.dateOfBirth;
        await DB_UPDATE_USER(partner.userID, modifiedPartner.getUniqueDatabaseProperties(partner));
        await DB_ASSIGN_PARTNER_STATUS(user.userID, partner.userID, ((i % 2) === 0) ? DATABASE_PARTNER_STATUS_ENUM.PARTNER : DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_USER);
    }

    /* Join Circles */
    const circleList = await getMockCircleList(4, 11);
    for(let i=0; i<circleList.length; i++) {
        await DB_INSERT_CIRCLE_USER_STATUS({circleID: circleList[i].circleID, userID:user.userID, status: ((i % 2) === 0) ? DATABASE_CIRCLE_STATUS_ENUM.MEMBER : DATABASE_CIRCLE_STATUS_ENUM.INVITE});
    }

    /* Share Prayer Requests */
    for(const request of await getMockPrayerRequestList(3, 50)) { //Likely already shared through circles
        await DB_INSERT_USER_RECIPIENT_PRAYER_REQUEST({prayerRequestID: request.prayerRequestID, userID: user.userID})
    }

    /* Add Owned Prayer Request */
    for(let i=0; i<2; i++) {
         await createMockPrayerRequest(user.userID);
    }

    await DB_DELETE_CONTACT_CACHE_BY_CIRCLE_BATCH(circleList.map(circle => circle.circleID), modifiedUserIDList);

    log.event(`Profile: ${user.userID} | ${user.displayName} populated with mock data.`);
    return await DB_POPULATE_USER_PROFILE(user);
}



/************************
 * UTILITIES & RESOURCES *
 ************************/
//Random number: exclusive of maximum, inclusive of minimum
const randomRange = (max:number = 2, min:number = 0):number => Math.floor(Math.random() * (max-min)) + min;
const randomDigits = (digits:number = 1) => randomRange(Math.pow(10, digits - 1), Math.pow(10, digits) - 1);

const getMockUserList = async(quantity:number, maxCircleMemberships?:number, maxSharedPrayerRequests?:number):Promise<ProfileListItem[]> => {
    const list:ProfileListItem[] = await DB_SELECT_USER_LIST_BY_SOURCE_ENVIRONMENT(DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK, quantity, maxCircleMemberships, maxSharedPrayerRequests);
    
    for(let i=list.length; i<quantity; i++) {
        list.push((await createMockUser(false)).toListItem());
    }
    return list;
}

const getMockCircleList = async(quantity:number, maxMembers?:number, maxSharedPrayerRequests?:number):Promise<CircleListItem[]> => {
    const list:CircleListItem[] = await DB_SELECT_CIRCLE_LIST_BY_USER_SOURCE_ENVIRONMENT(DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK, quantity, maxMembers, maxSharedPrayerRequests);
    
    if(list.length < quantity) {
        const leaderIDList:ProfileListItem[] = await getMockUserList(1, 0, 0); //New Leader
        for(let i=list.length; i<quantity; i++) {
            list.push((await createMockCircle(leaderIDList[0].userID)).toListItem());
        }
    }
    return list;
}

const getMockPrayerRequestList = async(quantity:number, maxUserShares?:number, maxCircleShares?:number):Promise<PrayerRequestListItem[]> => {
    const list:PrayerRequestListItem[] = await DB_SELECT_PRAYER_REQUEST_LIST_BY_USER_SOURCE_ENVIRONMENT(DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK, quantity, maxUserShares, maxCircleShares);
    
    if(list.length < quantity) {
        const userList:ProfileListItem[] = await getMockUserList(quantity - list.length);
        const currentListLength:number = list.length;
        for(let i=currentListLength; i<quantity; i++) {
            list.push((await createMockPrayerRequest(userList[i - currentListLength].userID)).toListItem());
        }
    }
    return list;
}
