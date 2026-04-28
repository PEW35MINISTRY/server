import * as log from '../../10-utilities/logging/log.mjs';
import { CircleAnnouncementListItem, CircleListItem } from "../../../0-assets/field-sync/api-type-sync/circle-types.mjs";
import { ContentListItem } from "../../../0-assets/field-sync/api-type-sync/content-types.mjs";
import { PrayerRequestCommentListItem, PrayerRequestListItem } from "../../../0-assets/field-sync/api-type-sync/prayer-request-types.mjs";
import { NewPartnerListItem, PartnerListItem, ProfileListItem } from "../../../0-assets/field-sync/api-type-sync/profile-types.mjs";
import { makeDisplayList, makeDisplayText } from "../../../0-assets/field-sync/input-config-sync/inputField.mjs";
import CIRCLE_ANNOUNCEMENT from "../../1-models/circleAnnouncementModel.mjs";
import USER from "../../1-models/userModel.mjs";
import { getEnv } from "../../10-utilities/utilities.mjs";
import { DATABASE_CIRCLE_STATUS_ENUM, DATABASE_PARTNER_STATUS_ENUM } from "../../2-database/database-types.mjs";
import { DB_SELECT_CIRCLE, DB_SELECT_CIRCLE_ANNOUNCEMENT_ALL_CIRCLES, DB_SELECT_CIRCLE_ANNOUNCEMENT_CURRENT, DB_SELECT_USER_CIRCLES } from "../../2-database/queries/circle-queries.mjs";
import { DB_SELECT_PARTNER_LIST } from "../../2-database/queries/partner-queries.mjs";
import { DB_SELECT_USER } from "../../2-database/queries/user-queries.mjs";
import { EMAIL_FONT_FAMILY, EMAIL_FONT_SIZE, EMAIL_COLOR, getEmailLineHeight, EMAIL_ROW_MARGIN, EMAIL_PROFILE_IMAGE_SIZE, EMAIL_CONTENT_MAX_WIDTH, DEFAULT_CIRCLE_URL, DEFAULT_PROFILE_URL } from "../email-types.mjs";
import { formatDate } from "../email-utilities.mjs";
import { htmlDetailTableRows, htmlTitle, htmlTableVerticalSpace, htmlVerticalSpace } from "./email-template-components.mjs";



/***************************************
 * Email Template List Item Components *
 ***************************************/

export const htmlUserContextProfile = (user:USER, details:[string, string][] = []):string => {

    return htmlProfileBlock(user.toListItem(), true, [
        ['Full Name:', `${user.firstName} ${user.lastName}`],
        ['Email:', makeDisplayText(user.email)],
        ['Roles:', makeDisplayList(user.userRoleList.map(role => String(role))).join(', ')],
        ['Source:', makeDisplayText(user.modelSourceEnvironment)],
        ['Joined EP:', formatDate(user.createdDT)],
        ...details
    ], true);
}


/* PROFILE */
export const htmlProfileBlock = (profile:ProfileListItem, includeUserID:boolean = false, details:[string, string][] = [], fullWidth:boolean = false):string =>
    `<table border="0" cellspacing="0" cellpadding="0" ${fullWidth ? `width="100%" style="width:100%; max-width:${EMAIL_CONTENT_MAX_WIDTH};"` : `style="margin-left:${EMAIL_PROFILE_IMAGE_SIZE * 1.5}px;"`} role="presentation">
        <tr>
            <td align="left" valign="top" style="font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.PRIMARY}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)};">
                <img src="${profile.image || DEFAULT_PROFILE_URL}" width="${EMAIL_PROFILE_IMAGE_SIZE}" height="${EMAIL_PROFILE_IMAGE_SIZE}" style="vertical-align:middle; border-radius:50%; margin-right:${EMAIL_PROFILE_IMAGE_SIZE / 2}px;" alt="Profile"/>
                ${includeUserID
                    ? `<a href="${getEnv('ENVIRONMENT_BASE_URL')}/portal/edit/user/${profile.userID}" style="color:${EMAIL_COLOR.PRIMARY}; text-decoration:none;"><b>${profile.firstName}</b></a> <span style="font-style:italic; color:${EMAIL_COLOR.BLACK};">(${profile.displayName})</span><span style="font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.GRAY_LIGHT}; font-weight:normal;"> | #${profile.userID}</span>`
                    : `<b>${profile.displayName}</b>`}
            </td>
        </tr>
        ${details.length ? htmlTableVerticalSpace(10) : ''}
        ${htmlDetailTableRows(details)}
    </table>`;


export const htmlProfileListBlock = (profileList:ProfileListItem[], title?:string, includeUserID:boolean = false, details:[string, string][] = []):string =>
    htmlTwoColumnListBlock<ProfileListItem>(profileList, (profile:ProfileListItem):string => htmlProfileBlock(profile, includeUserID, [], false), title, details);


/* Partners */
export const renderEmailPartnership = async(userID:number, title?:string, status?:DATABASE_PARTNER_STATUS_ENUM, includeUserID?:boolean, details?:[string, string][]):Promise<string> => {
    const profile:ProfileListItem = (await DB_SELECT_USER(new Map([['userID', userID]]))).toListItem();
    const partners:PartnerListItem[] = await DB_SELECT_PARTNER_LIST(userID, status);

    const partnershipList:{profile:PartnerListItem, partner:PartnerListItem}[] = partners.map(partner => ({profile:{...profile, status:partner.status}, partner}));

    return htmlPartnershipBlock(partnershipList, title, includeUserID, details);
}


export const htmlPartnershipBlock = (partnershipList:{profile:PartnerListItem, partner:PartnerListItem}[], title?:string, includeUserID:boolean = false, details:[string,string][] = []):string =>
    `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" align="center" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr>
            <td align="center" valign="top">
                <table width="${EMAIL_CONTENT_MAX_WIDTH}" border="0" cellspacing="0" cellpadding="0" role="presentation" align="center" style="margin:0 auto;">
                    <tr>
                        <td>
                            ${title ? htmlTitle(title, 'center') : ''}
                            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:${EMAIL_CONTENT_MAX_WIDTH}; width:100%; border-collapse:collapse; table-layout:fixed; mso-table-lspace:0pt; mso-table-rspace:0pt;">
                                <colgroup>
                                    <col style="width:${EMAIL_PROFILE_IMAGE_SIZE * 1.5}px;">
                                    <col style="width:50%;">
                                    <col style="width:50%;">
                                    <col style="width:${EMAIL_PROFILE_IMAGE_SIZE * 1.5}px;">
                                </colgroup>
                                ${partnershipList.map((item, index) =>
                                    `${(index > 0) ? `<tr><td colspan="4" height="${EMAIL_ROW_MARGIN}" style="line-height:${EMAIL_ROW_MARGIN}; font-size:${EMAIL_ROW_MARGIN};">&nbsp;</td></tr>`:''}
                                    <tr>
                                        <td align="left" valign="top">
                                            <img src="${item.profile.image || DEFAULT_PROFILE_URL}" width="${EMAIL_PROFILE_IMAGE_SIZE}" height="${EMAIL_PROFILE_IMAGE_SIZE}" style="vertical-align:middle;border-radius:50%;" alt="Profile ${item.profile.displayName}">
                                        </td>
                                        <td align="left" valign="top" style="font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.PRIMARY}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)};">
                                            ${includeUserID ? 
                                                `<div><b>${item.profile.firstName}</b> <span style="font-style:italic; color:${EMAIL_COLOR.BLACK};">(${item.profile.displayName})</span><span style="font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.GRAY_LIGHT}; font-weight:normal;"> | #${item.profile.userID}</span></div>`
                                                : `<div><b>${item.profile.firstName}</b></div>`}                                            
                                                <div style="font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.ACCENT};">${makeDisplayText(item.profile.status)}</div>
                                        </td>
                                        <td align="right" valign="top" style="font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.PRIMARY}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)};">
                                            ${includeUserID ? 
                                                `<div><b>${item.partner.firstName}</b> <span style="font-style:italic; color:${EMAIL_COLOR.BLACK};">(${item.partner.displayName})</span><span style="font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.GRAY_LIGHT}; font-weight:normal;"> | #${item.partner.userID}</span></div>`
                                                : `<div><b>${item.profile.firstName}</b></div>`}                                            
                                                <div style="font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.GRAY_LIGHT};">${formatDate(item.partner.partnershipDT) || formatDate(item.partner.contractDT)}</div>
                                        </td>
                                        <td align="right" valign="top">
                                            <img src="${item.partner.image || DEFAULT_PROFILE_URL}" width="${EMAIL_PROFILE_IMAGE_SIZE}" height="${EMAIL_PROFILE_IMAGE_SIZE}" style="vertical-align:middle;border-radius:50%;" alt="Partner ${item.partner.displayName}">
                                        </td>
                                    </tr>`).join('')}
                                    ${details.length ? htmlTableVerticalSpace(5) : ''}
                                    ${details.length ? htmlDetailTableRows(details, 4) : ''}
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>`;


//Lists matching criteria for unassigned users
export const htmlNewPartnerProfileTable = (userList:NewPartnerListItem[], includeUserID:boolean = false, details:[string,string][] = []):string => {

    return `<table border="0" cellspacing="0" cellpadding="0" class="full_width" align="left" role="presentation">
        <tr>
            <td align="left" valign="top" style="width:260px; padding-bottom:10px; font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.BLUE}; font-weight:bold;">User</td>
            <td align="left" valign="top" style="padding-bottom:10px; padding-left:12px; font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.BLUE}; font-weight:bold;">Max</td>
            <td align="left" valign="top" style="padding-bottom:10px; padding-left:12px; font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.BLUE}; font-weight:bold;">G</td>
            <td align="left" valign="top" style="padding-bottom:10px; padding-left:12px; font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.BLUE}; font-weight:bold;">DOB</td>
            <td align="left" valign="top" style="padding-bottom:10px; padding-left:12px; font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.BLUE}; font-weight:bold;">Walk</td>
            <td align="left" valign="top" style="padding-bottom:10px; padding-left:12px; font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.BLUE}; font-weight:bold;">Postal</td>
        </tr>
        ${userList.map(user =>
            `<tr>
                <td align="left" valign="middle" style="width:260px; padding:10px 0; font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.PRIMARY}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)}; border-top:1px solid ${EMAIL_COLOR.GRAY_LIGHT}; white-space:nowrap;">
                    <img src="${user.image || DEFAULT_PROFILE_URL}" width="${EMAIL_PROFILE_IMAGE_SIZE}" height="${EMAIL_PROFILE_IMAGE_SIZE}" style="vertical-align:middle; border-radius:50%; margin-right:${EMAIL_PROFILE_IMAGE_SIZE / 2}px;" alt="Profile"/>
                    ${includeUserID ? `<b>${user.firstName}</b> <span style="font-style:italic; color:${EMAIL_COLOR.BLACK};">(${user.displayName})</span><span style="font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.GRAY_LIGHT}; font-weight:normal;"> | #${user.userID}</span>` : `<b>${user.displayName}</b>`}
                </td>
                <td align="left" valign="middle" style="padding:10px 0 10px 12px; font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.BLACK}; border-top:1px solid ${EMAIL_COLOR.GRAY_LIGHT}; white-space:nowrap;">${user.maxPartners}</td>
                <td align="left" valign="middle" style="padding:10px 0 10px 12px; font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.BLACK}; border-top:1px solid ${EMAIL_COLOR.GRAY_LIGHT}; white-space:nowrap;">${String(user.gender).toUpperCase().startsWith('M') ? 'M' : String(user.gender).toUpperCase().startsWith('F') ? 'F' : '-'}</td>
                <td align="left" valign="middle" style="padding:10px 0 10px 12px; font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.BLACK}; border-top:1px solid ${EMAIL_COLOR.GRAY_LIGHT}; white-space:nowrap;">${formatDate(user.dateOfBirth)}</td>
                <td align="left" valign="middle" style="padding:10px 0 10px 12px; font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.BLACK}; border-top:1px solid ${EMAIL_COLOR.GRAY_LIGHT}; white-space:nowrap;">${user.walkLevel}</td>
                <td align="left" valign="middle" style="padding:10px 0 10px 12px; font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.BLACK}; border-top:1px solid ${EMAIL_COLOR.GRAY_LIGHT}; white-space:nowrap;">${user.postalCode}</td>
            </tr>` ).join('')}
            ${htmlDetailTableRows(details, 4)}
    </table>`;
}
    

/* CIRCLE */
export const renderEmailCircle = async(circleID:number, includeCircleID?:boolean, details?:[string, string][]):Promise<string> => {
    const circle:CircleListItem = (await DB_SELECT_CIRCLE(circleID)).toListItem();

    return htmlCircleBlock(circle, includeCircleID, details, true);
}


export const htmlCircleBlock = (circle:CircleListItem, includeCircleID:boolean = false, details:[string, string][] = [], fullWidth:boolean = false):string => {
    const circleTitle:string = includeCircleID
        ? `<a href="${getEnv('ENVIRONMENT_BASE_URL')}/portal/edit/circle/${circle.circleID}" style="color:${EMAIL_COLOR.ACCENT}; text-decoration:none;">${circle.name}</a><span style="font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.GRAY_LIGHT}; font-weight:normal;"> | #${circle.circleID}</span>`
        : circle.name;

    return `<table border="0" cellspacing="0" cellpadding="0" ${fullWidth ? `width="100%" style="width:100%; max-width:${EMAIL_CONTENT_MAX_WIDTH};"` : ''} role="presentation">
        <tr>
            <td align="left" valign="top" style="font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.PRIMARY}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)};">
                <img src="${circle.image || DEFAULT_CIRCLE_URL}" width="${EMAIL_PROFILE_IMAGE_SIZE}" height="${EMAIL_PROFILE_IMAGE_SIZE}" style="vertical-align:middle; border-radius:50%; margin-right:${EMAIL_PROFILE_IMAGE_SIZE / 2}px;" alt="Circle ${circle.name}">
                <span style="font-weight:bold; color:${EMAIL_COLOR.ACCENT};">${circleTitle}</span>
                ${circle.status ? `<span style="font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.GRAY_DARK};"> ${makeDisplayText(circle.status)}</span>` : ''}
            </td>
        </tr>
        ${details.length ? htmlTableVerticalSpace(10) : ''}
        ${details.length ? htmlDetailTableRows(details) : ''}
    </table>`;
}


export const renderEmailCircleList = async(userID:number, status?:DATABASE_CIRCLE_STATUS_ENUM, title?:string, includeCircleID?:boolean, details?:[string, string][]):Promise<string> => {
    const circleList:CircleListItem[] = await DB_SELECT_USER_CIRCLES(userID, status);
    if(!circleList || circleList.length === 0) return '';

    return htmlCircleListBlock(circleList, title, includeCircleID, details);
}

//2 Column View
export const htmlCircleListBlock = (circleList:CircleListItem[], title?:string, includeCircleID:boolean = false, details:[string, string][] = []):string =>
    htmlTwoColumnListBlock<CircleListItem>(circleList, (circle:CircleListItem):string => htmlCircleBlock(circle, includeCircleID, [], false), title, details);


/* CIRCLE ANNOUNCEMENT */
export const renderEmailCircleAnnouncements = async(circleID:number, includeCircleID?:boolean, details?:[string, string][]):Promise<string> => {
    const circle:CircleListItem = (await DB_SELECT_CIRCLE(circleID)).toListItem();

    const announcements:CIRCLE_ANNOUNCEMENT[] = await DB_SELECT_CIRCLE_ANNOUNCEMENT_CURRENT(circleID);
    const announcementPairList:{circle:CircleListItem,announcement:CircleAnnouncementListItem}[] = announcements.map(announcement => ({circle, announcement:announcement.toListItem()}));

    return htmlCircleAnnouncementBlock(announcementPairList, includeCircleID, details);
}

export const renderEmailCircleAnnouncementsAll = async(userID:number, includeCircleID?:boolean, details?:[string, string][]):Promise<string> => {
    const announcements:CIRCLE_ANNOUNCEMENT[] = await DB_SELECT_CIRCLE_ANNOUNCEMENT_ALL_CIRCLES(userID);
    if(!announcements?.length) return '';

    //Match Member Circles to Circle ID's
    const circles:CircleListItem[] = await DB_SELECT_USER_CIRCLES(userID, DATABASE_CIRCLE_STATUS_ENUM.MEMBER);
    const circleMap:Map<number, CircleListItem> = new Map(circles.map(circle => [circle.circleID, circle]));

    const pairs:{circle:CircleListItem,announcement:CircleAnnouncementListItem}[] = [];
    for(const announcement of announcements){
        const circle:CircleListItem = circleMap.get(announcement.circleID);
        if(!circle){
            console.error('Email_renderEmailCircleAnnouncementsAll', `No matching MEMBER circle found for announcement: ${announcement.announcementID} for circle: ${announcement.circleID}`);
            continue;
        }
        pairs.push({circle, announcement: announcement.toListItem()});
    }

    return htmlCircleAnnouncementBlock(pairs, includeCircleID, details);
}


const htmlCircleAnnouncementBlock = (announcementPairList:{circle:CircleListItem, announcement:CircleAnnouncementListItem}[], includeCircleID:boolean = false, details:[string, string][] = []):string => {
    if(!announcementPairList?.length) return '';

    return `<table role="presentation" width="${EMAIL_CONTENT_MAX_WIDTH}" border="0" cellspacing="0" cellpadding="0" align="left" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        ${announcementPairList.map(({circle, announcement}:{circle:CircleListItem, announcement:CircleAnnouncementListItem}, index:number):string =>
            `${(index > 0) ? `<tr><td height="${EMAIL_ROW_MARGIN}" style="line-height:${EMAIL_ROW_MARGIN}px; font-size:${EMAIL_ROW_MARGIN}px;">&nbsp;</td></tr>` : ''}
                <tr>
                    <td align="left" valign="top" style="font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)};">
                        ${htmlCircleBlock(circle, includeCircleID, (announcement.startDate || announcement.endDate) ?
                            [['', `${announcement.startDate ? formatDate(announcement.startDate) : ''}${announcement.endDate ? ` &ndash; ${formatDate(announcement.endDate)}` : ''}`]] : [])}
                        ${htmlTableVerticalSpace(5)}
                        <div style="font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.BLACK}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT, 1.5)}; margin-top:4px;">${announcement.message || ''}</div>
                    </td>
                </tr>`).join('')}
        ${details.length ? htmlTableVerticalSpace(10) : ''}
        ${htmlDetailTableRows(details, 1)}
    </table>`;
}



/* PRAYER REQUESTS */
export const htmlPrayerRequestBlock = (prayerRequest:PrayerRequestListItem, includeID:boolean = false, details:[string, string][] = []):string => {
    if(!prayerRequest.requestorProfile) log.warnWithTrace('Email Template -> htmlPrayerRequestBlock: requestorProfile not populated', prayerRequest);

    return `<table border="0" cellspacing="0" cellpadding="0" width="100%" style="width:100%; max-width:${EMAIL_CONTENT_MAX_WIDTH};" role="presentation">
        <tr>
            <td align="left" valign="top" width="420" style="width:420px; padding:0;">
                <table border="0" cellspacing="0" cellpadding="0" width="100%" style="width:100%;" role="presentation">
                    <tr>
                        <td align="left" valign="top" style="font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.PRIMARY}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)};">
                            ${includeID
                                ? `<a href="${getEnv('ENVIRONMENT_BASE_URL')}/portal/edit/prayer-request/${prayerRequest.prayerRequestID}" style="color:${EMAIL_COLOR.PRIMARY}; text-decoration:none;"><b>${prayerRequest.topic}</b></a><span style="font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.GRAY_LIGHT}; font-weight:normal;"> | #${prayerRequest.prayerRequestID}</span>`
                                : `<b>${prayerRequest.topic}</b>`}
                        </td>
                    </tr>
                    <tr>
                        <td align="left" valign="top" style="font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.BLACK}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)}; white-space:pre-wrap;">${prayerRequest.description}</td>
                    </tr>
                    ${htmlTableVerticalSpace(2)}
                    <tr>
                        <td align="left" valign="top" style="font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.GRAY_LIGHT}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.DETAIL)};">${prayerRequest.tagList.length ? prayerRequest.tagList.join(', ') : 'No tags'} | ${prayerRequest.prayerCount} prayer${prayerRequest.prayerCount === 1 ? '' : 's'}</td>
                    </tr>
                    ${details.length ? htmlTableVerticalSpace(10) : ''}
                    ${htmlDetailTableRows(details)}
                </table>
            </td>
            ${prayerRequest.requestorProfile
                ? `<td align="left" valign="top" width="180" style="width:180px; padding:0 0 0 12px;">
                    ${htmlProfileBlock(prayerRequest.requestorProfile, includeID)}
                </td>`
                : ''}
        </tr>
    </table>`;
}


export const htmlPrayerRequestCommentBlock = (comment:PrayerRequestCommentListItem, includeID:boolean = false, details:[string, string][] = []):string => {
    if(!comment.commenterProfile) log.warnWithTrace('Email Template -> htmlPrayerRequestCommentBlock: commenterProfile not populated', comment);

    return `<table border="0" cellspacing="0" cellpadding="0" width="100%" style="width:100%; max-width:${EMAIL_CONTENT_MAX_WIDTH};" role="presentation">
        <tr>
            <td align="left" valign="top" width="420" style="width:420px; padding:0;">
                <table border="0" cellspacing="0" cellpadding="0" width="100%" style="width:100%;" role="presentation">
                    <tr>
                        <td align="left" valign="top" style="font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.PRIMARY}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)};">
                            ${includeID
                                ? `<a href="${getEnv('ENVIRONMENT_BASE_URL')}/portal/edit/prayer-request/${comment.prayerRequestID}" style="color:${EMAIL_COLOR.PRIMARY}; text-decoration:none;"><b>Prayer Request Comment</b></a><span style="font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.GRAY_LIGHT}; font-weight:normal;"> | #${comment.commentID}</span>`
                                : `<b>Prayer Request Comment</b>`}
                        </td>
                    </tr>
                    <tr>
                        <td align="left" valign="top" style="font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.BLACK}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)}; white-space:pre-wrap;">${comment.message}</td>
                    </tr>
                    ${htmlTableVerticalSpace(2)}
                    <tr>
                        <td align="left" valign="top" style="font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.GRAY_LIGHT}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.DETAIL)};">${comment.likeCount} like${comment.likeCount === 1 ? '' : 's'} | ${comment.createdDT}${includeID ? ` | Prayer Request #${comment.prayerRequestID}` : ''}</td>
                    </tr>
                    ${details.length ? htmlTableVerticalSpace(10) : ''}
                    ${htmlDetailTableRows(details)}
                </table>
            </td>
            ${comment.commenterProfile
                ? `<td align="left" valign="top" width="180" style="width:180px; padding:0 0 0 12px;">
                    ${htmlProfileBlock(comment.commenterProfile, includeID)}
                </td>`
                : ''}
        </tr>
    </table>`;
}



/* CONTENT MEDIA */
export const htmlContentBlock = (content:ContentListItem, includeID:boolean = false, details:[string,string][] = []):string => 
    `<table border="0" cellspacing="0" cellpadding="0" width="100%" style="width:100%; max-width:${EMAIL_CONTENT_MAX_WIDTH};" role="presentation">
        <tr>
            <td align="left" valign="top" style="width:100%; font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.PRIMARY}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)};">
                ${includeID
                    ? `<a href="${getEnv('ENVIRONMENT_BASE_URL')}/portal/edit/content/${content.contentID}" style="color:${EMAIL_COLOR.PRIMARY}; text-decoration:none;"><b>${content.title || content.url || `Content #${content.contentID}`}</b></a><span style="font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.GRAY_LIGHT}; font-weight:normal;"> | #${content.contentID}</span>`
                    : `<b>${content.title || content.url || `Content #${content.contentID}`}</b>`}
            </td>
        </tr>
        ${content.description ? `
        <tr>
            <td align="left" valign="top" style="width:100%; font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.BLACK}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)}; white-space:pre-wrap;">
                ${content.description}
            </td>
        </tr>` : ''}
        <tr>
            <td align="left" valign="top" style="width:100%; font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.GRAY_LIGHT}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.DETAIL)};">
                ${content.type} | ${content.source} | ${content.likeCount} like${content.likeCount === 1 ? '' : 's'} | ${content.modifiedDT}
            </td>
        </tr>
        ${content.url || content.keywordList.length || details.length ? htmlTableVerticalSpace(10) : ''}
        ${htmlDetailTableRows([
            ...(content.url ? [['URL', content.url] as [string,string]] : []),
            ...(content.keywordList.length ? [['Keywords', content.keywordList.join(', ')] as [string,string]] : []),
            ...details
        ])}
    </table>`;




/* LOCAL UTILITIES */
export const htmlTwoColumnListBlock = <T,>(itemList:T[], renderItem:(item:T) => string, title?:string, details:[string, string][] = []):string => {
    if(!itemList?.length) return '';

    return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" align="left" style="border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt;">
        <tr>
            <td align="left" valign="top">
                ${title ? htmlTitle(title) : ''}
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; max-width:${EMAIL_CONTENT_MAX_WIDTH}; border-collapse:collapse;">
                    ${itemList.map((item:T, index:number):string => index % 2 !== 0 ? '' : `
                        ${index > 0 ? `<tr><td colspan="2" height="${EMAIL_ROW_MARGIN}" style="height:${EMAIL_ROW_MARGIN}px; line-height:${EMAIL_ROW_MARGIN}px; font-size:${EMAIL_ROW_MARGIN}px;">&nbsp;</td></tr>` : ''}
                        <tr>
                            <td align="left" valign="top" width="50%" style="width:50%; padding-right:12px;">
                                ${renderItem(item)}
                            </td>
                            <td align="left" valign="top" width="50%" style="width:50%;">
                                ${itemList[index + 1] ? renderItem(itemList[index + 1]) : '&nbsp;'}
                            </td>
                        </tr>
                    `).join('')}
                    ${details.length ? htmlTableVerticalSpace(10) : ''}
                    ${details.length ? htmlDetailTableRows(details, 2) : ''}
                </table>
            </td>
        </tr>
    </table>`;
}
