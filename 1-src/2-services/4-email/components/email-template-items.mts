import { CircleAnnouncementListItem, CircleListItem } from "../../../0-assets/field-sync/api-type-sync/circle-types.mjs";
import { PartnerListItem, ProfileListItem } from "../../../0-assets/field-sync/api-type-sync/profile-types.mjs";
import { makeDisplayText } from "../../../0-assets/field-sync/input-config-sync/inputField.mjs";
import CIRCLE_ANNOUNCEMENT from "../../1-models/circleAnnouncementModel.mjs";
import { DATABASE_CIRCLE_STATUS_ENUM, DATABASE_PARTNER_STATUS_ENUM } from "../../2-database/database-types.mjs";
import { DB_SELECT_CIRCLE, DB_SELECT_CIRCLE_ANNOUNCEMENT_ALL_CIRCLES, DB_SELECT_CIRCLE_ANNOUNCEMENT_CURRENT, DB_SELECT_USER_CIRCLES } from "../../2-database/queries/circle-queries.mjs";
import { DB_SELECT_PARTNER_LIST } from "../../2-database/queries/partner-queries.mjs";
import { DB_SELECT_USER } from "../../2-database/queries/user-queries.mjs";
import { EMAIL_FONT_FAMILY, EMAIL_FONT_SIZE, EMAIL_COLOR, getEmailLineHeight, EMAIL_ROW_MARGIN, EMAIL_PROFILE_IMAGE_SIZE, EMAIL_CONTENT_MAX_WIDTH, DEFAULT_CIRCLE_URL, DEFAULT_PROFILE_URL } from "../email-types.mjs";
import { formatDate } from "../email-utilities.mjs";
import { htmlDetailTableRows, htmlTitle, htmlVerticalSpace } from "./email-template-components.mjs";



/***************************************
 * Email Template List Item Components *
 ***************************************/

export const renderEmailProfile = async(userID:number, includeUserID?:boolean, details?:[string, string][]):Promise<string> => {
    const profile:ProfileListItem = (await DB_SELECT_USER(new Map([['userID', userID]]))).toListItem();

    return htmlProfileBlock(profile, includeUserID, details);
}


/* PROFILE */
export const htmlProfileBlock = (profile:ProfileListItem, includeUserID:boolean = false, details:[string, string][] = []):string =>
    `<table border="0" cellspacing="0" cellpadding="0" class="full_width" align="left" role="presentation">
        <tr>
            <td align="left" valign="top" style="font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.PRIMARY}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)};">
                <img src="${profile.image || DEFAULT_PROFILE_URL}" width="${EMAIL_PROFILE_IMAGE_SIZE}" height="${EMAIL_PROFILE_IMAGE_SIZE}" style="vertical-align:middle; border-radius:50%; margin-right:${EMAIL_PROFILE_IMAGE_SIZE / 2}px;" alt="Profile"/>
                ${includeUserID ? 
                    `<b>${profile.firstName}</b> <span style="font-style:italic; color:${EMAIL_COLOR.BLACK};">(${profile.displayName})</span><span style="font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.GRAY_LIGHT}; font-weight:normal;"> | #${profile.userID}</span>`
                    : `<b>${profile.displayName}</b>`}                                        
            </td>
        </tr>
        ${details.length ? htmlVerticalSpace(10) : ''}
        ${htmlDetailTableRows(details)}
    </table>`;


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
                                    `${(index > 0) ? `<tr><td colspan="4" height="${EMAIL_ROW_MARGIN}" style="line-height:${EMAIL_ROW_MARGIN}px; font-size:${EMAIL_ROW_MARGIN}px;">&nbsp;</td></tr>`:''}
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
                                ${htmlDetailTableRows(details, 4)}
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>`;
    

/* CIRCLE */
export const renderEmailCircle = async(circleID:number, includeCircleID?:boolean, details?:[string, string][]):Promise<string> => {
    const circle:CircleListItem = (await DB_SELECT_CIRCLE(circleID)).toListItem();

    return htmlCircleBlock([circle], undefined, includeCircleID, details);
}

export const renderEmailCircleList = async(userID:number, status?:DATABASE_CIRCLE_STATUS_ENUM, title?:string, includeCircleID?:boolean, details?:[string, string][]):Promise<string> => {
    const circleList:CircleListItem[] = await DB_SELECT_USER_CIRCLES(userID, status);
    if(!circleList || circleList.length === 0) return '';

    return htmlCircleBlock(circleList, title, includeCircleID, details);
};



const htmlCircleBlock = (circleList:CircleListItem[], title?:string, includeCircleID:boolean = false, details:[string, string][] = []):string => {
    if(!circleList?.length) return '';

    return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" align="left" style="border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt;">
        <tr>
            <td align="left" valign="top">
                ${title ? htmlTitle(title) : ''}
                <table width="${EMAIL_CONTENT_MAX_WIDTH}" border="0" cellspacing="0" cellpadding="0" role="presentation" align="left" style="margin:0; border-collapse:collapse; table-layout:fixed; max-width:${EMAIL_CONTENT_MAX_WIDTH}; width:100%; mso-table-lspace:0pt; mso-table-rspace:0pt;">
                    <colgroup>
                        <col style="width:${EMAIL_PROFILE_IMAGE_SIZE * 1.5}px;">
                        <col style="width:auto;">
                    </colgroup>
                    ${circleList.map((circle,index) => 
                        `<tr>
                            <td align="left" valign="top">
                                <img src="${circle.image || DEFAULT_CIRCLE_URL}" width="${EMAIL_PROFILE_IMAGE_SIZE}" height="${EMAIL_PROFILE_IMAGE_SIZE}" style="vertical-align:middle; border-radius:50%;" alt="Circle ${circle.name}">
                            </td>
                            <td align="left" valign="top" style="font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)};">
                                <div style="font-weight:bold; color:${EMAIL_COLOR.ACCENT};">
                                    ${includeCircleID ? 
                                        `${circle.name}<span style="font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.GRAY_LIGHT}; font-weight:normal;"> | #${circle.circleID}</span>`
                                        : `${circle.name}`}
                                </div>
                                <div style="font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.GRAY_DARK};">
                                    ${makeDisplayText(circle.status)}
                                </div>
                            </td>
                        </tr>`).join('')}
                    ${details.length ? htmlVerticalSpace(10) : ''}
                    ${htmlDetailTableRows(details, 2)}
                </table>
            </td>
        </tr>
    </table>`;
};


/* CIRCLE ANNOUNCEMENT */
export const renderEmailCircleAnnouncements = async(circleID:number, includeCircleID?:boolean, details?:[string, string][]):Promise<string> => {
    const circle:CircleListItem = (await DB_SELECT_CIRCLE(circleID)).toListItem();

    const announcements:CIRCLE_ANNOUNCEMENT[] = await DB_SELECT_CIRCLE_ANNOUNCEMENT_CURRENT(circleID);
    const announcementPairList:{circle:CircleListItem,announcement:CircleAnnouncementListItem}[] = announcements.map(announcement => ({circle, announcement:announcement.toListItem()}));

    return htmlCircleAnnouncementBlock(announcementPairList, includeCircleID, details);
};

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
};


const htmlCircleAnnouncementBlock = (announcementPairList:{circle:CircleListItem, announcement:CircleAnnouncementListItem}[], includeCircleID:boolean = false, details:[string, string][] = []):string => {
    if(!announcementPairList?.length) return '';

    return `<table role="presentation" width="${EMAIL_CONTENT_MAX_WIDTH}" border="0" cellspacing="0" cellpadding="0" align="left" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        ${announcementPairList.map(({ circle, announcement }:{circle:CircleListItem; announcement:CircleAnnouncementListItem }, index:number) =>
            `${(index > 0)?`<tr><td height="${EMAIL_ROW_MARGIN}" style="line-height:${EMAIL_ROW_MARGIN}px;font-size:${EMAIL_ROW_MARGIN}px;">&nbsp;</td></tr>`:''}
                <tr>
                    <td align="left" valign="top" style="font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)};">
                        ${htmlCircleBlock([circle], undefined, includeCircleID, (announcement.startDate || announcement.endDate) ? 
                            [['', `${announcement.startDate ? formatDate(announcement.startDate) : ''}${announcement.endDate ? ` &ndash; ${formatDate(announcement.endDate)}` : ''}`]] : [])}
                        ${htmlVerticalSpace(5)}
                        <div style="font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.BLACK}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT, 1.5)}; margin-top:4px;">${announcement.message || ''}</div>
                    </td>
                </tr>`).join('')}
        ${details.length ? htmlVerticalSpace(10) : ''}
        ${htmlDetailTableRows(details, 1)}
    </table>`;
};