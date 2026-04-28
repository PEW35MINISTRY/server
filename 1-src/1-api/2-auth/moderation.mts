import * as log from '../../2-services/10-utilities/logging/log.mjs';
import { Response, NextFunction } from 'express';
import USER from '../../2-services/1-models/userModel.mjs';
import { DB_SELECT_USER, DB_UPDATE_USER } from '../../2-services/2-database/queries/user-queries.mjs';
import { JwtCircleRequest, JwtClientRequest, JwtContentRequest, JwtPrayerRequest } from './auth-types.mjs';
import { DATABASE_CIRCLE_STATUS_ENUM, DATABASE_MODERATION_STATUS } from '../../2-services/2-database/database-types.mjs';
import { PrayerRequestCommentListItem, PrayerRequestListItem } from '../../0-assets/field-sync/api-type-sync/prayer-request-types.mjs';
import PRAYER_REQUEST from '../../2-services/1-models/prayerRequestModel.mjs';
import { DB_SELECT_CONTENT, DB_UPDATE_CONTENT } from '../../2-services/2-database/queries/content-queries.mjs';
import { DB_SELECT_PRAYER_REQUEST, DB_UPDATE_PRAYER_REQUEST, DB_SELECT_PRAYER_REQUEST_COMMENT, DB_SET_PRAYER_REQUEST_COMMENT_MODERATION } from '../../2-services/2-database/queries/prayer-request-queries.mjs';
import { Exception } from '../api-types.mjs';
import CONTENT_ARCHIVE from '../../2-services/1-models/contentArchiveModel.mjs';
import { sendModerationEmail, sendUserModeratedItemRemovedEmail, sendUserLockedAccountEmail } from '../../2-services/4-email/configurations/email-moderation.mjs';
import { LogType } from '../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import LOG_ENTRY from '../../2-services/10-utilities/logging/logEntryModel.mjs';
import { htmlActionButton, htmlText, htmlTitle } from '../../2-services/4-email/components/email-template-components.mjs';
import { htmlCircleBlock, htmlContentBlock, htmlPrayerRequestBlock, htmlPrayerRequestCommentBlock, htmlProfileBlock, htmlUserContextProfile } from '../../2-services/4-email/components/email-template-items.mjs';
import { formatDate, minorInvolved } from '../../2-services/4-email/email-utilities.mjs';
import { ProfileListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import CIRCLE from '../../2-services/1-models/circleModel.mjs';
import { DB_SELECT_CIRCLE, DB_SELECT_CIRCLE_USER_LIST } from '../../2-services/2-database/queries/circle-queries.mjs';
import { getEnv } from '../../2-services/10-utilities/utilities.mjs';



/****************************************
*       MODEL MODERATION ROUTES         *
* Handling Blocking & Reporting Actions *
*****************************************/

//Blacklists JWT and prevents access to system
export const POST_userReported = async(request:JwtClientRequest, response:Response, next:NextFunction):Promise<void> => {
    response.status(200).send('User Action Reported'); // Always return success

    const description:string = (typeof request.body?.description === 'string') && request.body.description.trim()
                                ? request.body.description.trim() : 'No Description Provided';
    const flaggedUser:USER = await DB_SELECT_USER(new Map([['userID', request.clientID]]));
    const reportingUser:USER = await DB_SELECT_USER(new Map([['userID', request.jwtUserID]]));

    if(!flaggedUser.isValid || !reportingUser.isValid) {
        log.warn(`USER REPORT FAILED - Invalid User Profiles`, `flaggedUserID=${request.clientID}`, `reportingUserID=${request.jwtUserID}`, `Event=${description}`);
        return;
    }

    const logEntry:LOG_ENTRY = new LOG_ENTRY(LogType.EVENT, [
        `USER REPORTED - Review Required`, `Event=${description}`,
        `Flagged User: userID=${flaggedUser.userID}, displayName=${flaggedUser.displayName}, email=${flaggedUser.email}, modelSource=${flaggedUser.modelSourceEnvironment}`,
        `Reporting User: userID=${reportingUser.userID}, displayName=${reportingUser.displayName}, email=${reportingUser.email}`
    ]);
    await log.event(...logEntry.messages);

    await DB_UPDATE_USER(flaggedUser.userID, new Map<string, DATABASE_MODERATION_STATUS>([['moderationStatus', DATABASE_MODERATION_STATUS.BLOCKED]]));

    await sendModerationEmail({
        minorInvolved: minorInvolved(flaggedUser, reportingUser),
        reportingSubject:'USER', description, reportingUser,
        flaggedHTMLList:[
            htmlUserContextProfile(flaggedUser),
            htmlActionButton([
                {
                    label: 'Reported User',
                    link: `${getEnv('ENVIRONMENT_BASE_URL')}/portal/edit/user/${flaggedUser.userID}`,
                    style: 'PRIMARY'
                }
            ])
        ],
        alternativeTextBody: logEntry.toString()
    });

    await sendUserLockedAccountEmail(flaggedUser);
}


export const POST_circleReported = async(request:JwtCircleRequest, response:Response, next:NextFunction):Promise<void> => {
    if(request.params.circle === undefined || isNaN(parseInt(request.params.circle))) {
        next(new Exception(400, `Failed to parse circleID URL parameter :: circle:${request.params.circle}`, 'Missing Details'));
        return;

    } else
        response.status(200).send('Circle Action Reported'); // Always return success

    const circleID:number = parseInt(request.params.circle);
    const description:string = (typeof request.body?.description === 'string') && request.body.description.trim()
                                ? request.body.description.trim() : 'No Description Provided';
                                
    const flaggedCircle:CIRCLE = await DB_SELECT_CIRCLE(circleID);
    const reportingUser:USER = await DB_SELECT_USER(new Map([['userID', request.jwtUserID]]));

    if(!flaggedCircle.isValid || !reportingUser.isValid) {
        log.warn(`CIRCLE REPORT FAILED - Circle Not Found`, `circleID=${circleID}`, `reportingUserID=${request.jwtUserID}`, `Event=${description}`);
        return;
    }

    const flaggedLeader:USER = await DB_SELECT_USER(new Map([['userID', flaggedCircle.leaderID]]));
    const circleMemberList:ProfileListItem[] = await DB_SELECT_CIRCLE_USER_LIST(circleID, DATABASE_CIRCLE_STATUS_ENUM.MEMBER);

    const logEntry:LOG_ENTRY = new LOG_ENTRY(LogType.EVENT, [
        `CIRCLE REPORTED - Review Required`, `Event=${description}`,
        `Flagged Circle: circleID=${flaggedCircle.circleID}, leaderID=${flaggedCircle.leaderID}, name=${flaggedCircle.name}, description=${flaggedCircle.description}, modifiedDT=${flaggedCircle.modifiedDT.toISOString()}`,
        `Circle Leader: userID=${flaggedLeader.userID}, displayName=${flaggedLeader.displayName}, email=${flaggedLeader.email}, modelSource=${flaggedLeader.modelSourceEnvironment}`,
        `Reporting User: userID=${reportingUser.userID}, displayName=${reportingUser.displayName}, email=${reportingUser.email}`
    ]);
    await log.event(...logEntry.messages);

    await DB_UPDATE_USER(flaggedCircle.circleID, new Map<string, DATABASE_MODERATION_STATUS>([['moderationStatus', DATABASE_MODERATION_STATUS.BLOCKED]]));
    await sendModerationEmail({
        minorInvolved: minorInvolved(flaggedLeader, reportingUser),
        reportingSubject:'CIRCLE', description, reportingUser,
        flaggedHTMLList:[
            htmlTitle('Flagged Circle'),
            htmlCircleBlock([flaggedCircle.toListItem()], undefined, true, [
                ['Created:', formatDate(flaggedCircle.createdDT)],
                ['Last Modified:', formatDate(flaggedCircle.modifiedDT)]
            ]),

            htmlTitle('Circle Leader'),
            htmlUserContextProfile(flaggedLeader),
            htmlActionButton([
                {
                    label: 'Leader',
                    link: `${getEnv('ENVIRONMENT_BASE_URL')}/portal/edit/user/${flaggedLeader.userID}`,
                    style: 'ACCENT'
                },
                {
                    label: 'Circle',
                    link: `${getEnv('ENVIRONMENT_BASE_URL')}/portal/edit/circle/${flaggedCircle.circleID}`,
                    style: 'PRIMARY'
                }
            ])
        ],
        relatedHTMLList:[
            htmlTitle('Circle Members'),
            ...circleMemberList.map((member:ProfileListItem) => htmlProfileBlock(member))
        ],
        alternativeTextBody: logEntry.toString()
    });

    await sendUserModeratedItemRemovedEmail(flaggedLeader, {
        subject: 'Circle',
        title: flaggedCircle.name,
        flaggedHTMLList: [
            htmlTitle('Flagged Circle'),
            htmlCircleBlock([flaggedCircle.toListItem()]),
            htmlText('Note: Circle members have not yet been notified about this review; however they may see circle functionality removed temporarily.')
        ]
    });
}


export const POST_contentReported = async(request:JwtContentRequest, response:Response, next:NextFunction):Promise<void> => {
    if(request.params.content === undefined || isNaN(parseInt(request.params.content))) {
        next(new Exception(400, `Failed to parse contentID :: missing content-id parameter :: ${request.params.content}`, 'Missing Content'));
        return;

    } else
        response.status(200).send('Content Action Reported'); // Always return success

    const contentID:number = parseInt(request.params.content);
    const description:string = (typeof request.body?.description === 'string') && request.body.description.trim()
                                ? request.body.description.trim() : 'No Description Provided';

    const flaggedContent:CONTENT_ARCHIVE = await DB_SELECT_CONTENT(contentID);
    const reportingUser:USER = await DB_SELECT_USER(new Map([['userID', request.jwtUserID]]));
    const uploadingUser:USER = await DB_SELECT_USER(new Map([['userID', flaggedContent.recorderID]]));

    if(!flaggedContent.isValid || !reportingUser.isValid || !uploadingUser.isValid) {
        log.warn(`CONTENT REPORT FAILED - Content Not Found`, `contentID=${contentID}`, `contentRecorderUserID=${flaggedContent.recorderID}`, `reportingUserID=${request.jwtUserID}`, `Event=${description}`);
        return;
    }

    const logEntry:LOG_ENTRY = new LOG_ENTRY(LogType.EVENT, [
        `CONTENT REPORTED - Review Required`, `Event=${description}`,
        `Flagged Content: contentID=${flaggedContent.contentID}, recorderID=${flaggedContent.recorderID}, title=${flaggedContent.title}, description=${flaggedContent.description}, url=${flaggedContent.url}, notes=${flaggedContent.notes}, modifiedDT=${flaggedContent.modifiedDT.toISOString()}`,
        `Uploading User: userID=${uploadingUser.userID}, displayName=${uploadingUser.displayName}, email=${uploadingUser.email}, modelSource=${uploadingUser.modelSourceEnvironment}`,
        `Reporting User: userID=${reportingUser.userID}, displayName=${reportingUser.displayName}, email=${reportingUser.email}`
    ]);
    await log.event(...logEntry.messages);

    await DB_UPDATE_CONTENT(flaggedContent.contentID, new Map<string, DATABASE_MODERATION_STATUS>([['moderationStatus', DATABASE_MODERATION_STATUS.REPORTED]]));
    await sendModerationEmail({
        minorInvolved: minorInvolved(uploadingUser, reportingUser),
        reportingSubject:'CONTENT',
        description,
        reportingUser,
        flaggedHTMLList:[
            htmlTitle('Flagged Content'),
            htmlContentBlock(flaggedContent.toListItem()),
            htmlActionButton([
                {
                    label: 'Content',
                    link: `${getEnv('ENVIRONMENT_BASE_URL')}/portal/edit/content/${flaggedContent.contentID}`,
                    style: 'PRIMARY'
                }
            ])
        ],
        relatedHTMLList:[
            htmlTitle('Uploading User'),
            htmlUserContextProfile(uploadingUser)
        ],
        alternativeTextBody: logEntry.toString()
    });
}


export const POST_prayerRequestReported = async(request:JwtPrayerRequest, response:Response, next:NextFunction):Promise<void> => {
    if(request.params.prayer === undefined || isNaN(parseInt(request.params.prayer))) {
        next(new Exception(400, `Failed to parse prayerRequestID :: missing prayer-request-id parameter :: ${request.params.prayer}`, 'Missing Prayer Request'));
        return;

    } else
        response.status(200).send('Prayer Request Action Reported'); // Always return success

    const prayerRequestID:number = parseInt(request.params.prayer);
    const description:string = (typeof request.body?.description === 'string') && request.body.description.trim()
                                ? request.body.description.trim() : 'No Description Provided';

    const flaggedPrayerRequest:PRAYER_REQUEST = await DB_SELECT_PRAYER_REQUEST(prayerRequestID);
    const reportingUser:USER = await DB_SELECT_USER(new Map([['userID', request.jwtUserID]]));
    const flaggedUser:USER = await DB_SELECT_USER(new Map([['userID', flaggedPrayerRequest.requestorID]]));
    const flaggedPrayerRequestListItem:PrayerRequestListItem = flaggedPrayerRequest.toListItem();
    flaggedPrayerRequestListItem.requestorProfile = flaggedUser.toListItem();

    if(!flaggedPrayerRequest.isValid || !reportingUser.isValid || !flaggedUser.isValid) {
        log.warn(`PRAYER REQUEST REPORT FAILED - Prayer Request Not Found`, `prayerRequestID=${prayerRequestID}`, `prayerRequestorUserID=${flaggedPrayerRequest.requestorID}`, `reportingUserID=${request.jwtUserID}`, `Event=${description}`);
        return;
    }

    const logEntry:LOG_ENTRY = new LOG_ENTRY(LogType.EVENT, [
        `PRAYER REQUEST REPORTED - Review Required`, `Event=${description}`,
        `Flagged Prayer Request: prayerRequestID=${flaggedPrayerRequest.prayerRequestID}, requestorID=${flaggedPrayerRequest.requestorID}, topic=${flaggedPrayerRequest.topic}, description=${flaggedPrayerRequest.description}, modifiedDT=${flaggedPrayerRequest.modifiedDT.toISOString()}`,
        `Flagged User: userID=${flaggedUser.userID}, displayName=${flaggedUser.displayName}, email=${flaggedUser.email}, modelSource=${flaggedUser.modelSourceEnvironment}`,
        `Reporting User: userID=${reportingUser.userID}, displayName=${reportingUser.displayName}, email=${reportingUser.email}`
    ]);
    await log.event(...logEntry.messages);

    await DB_UPDATE_PRAYER_REQUEST(flaggedPrayerRequest.prayerRequestID, new Map<string, DATABASE_MODERATION_STATUS>([['moderationStatus', DATABASE_MODERATION_STATUS.REPORTED]]));
    await sendModerationEmail({
        minorInvolved: minorInvolved(flaggedUser, reportingUser),
        reportingSubject:'PRAYER_REQUEST', description, reportingUser,
        flaggedHTMLList:[
            htmlTitle('Flagged Prayer Request'),
            htmlPrayerRequestBlock(flaggedPrayerRequestListItem, true, [
                ['Created:', formatDate(flaggedPrayerRequest.createdDT)],
                ['Last Modified:', formatDate(flaggedPrayerRequest.modifiedDT)]
            ]),
            htmlActionButton([
                {
                    label: 'Reported User',
                    link: `${getEnv('ENVIRONMENT_BASE_URL')}/portal/edit/user/${flaggedUser.userID}`,
                    style: 'ACCENT'
                },
                {
                    label: 'Prayer Request',
                    link: `${getEnv('ENVIRONMENT_BASE_URL')}/portal/edit/prayer-request/${request.prayerRequestID}`,
                    style: 'PRIMARY'
                }
            ]),
            htmlTitle('Flagged User'),
            htmlUserContextProfile(flaggedUser)
        ],
        alternativeTextBody: logEntry.toString()
    });
    
    await sendUserModeratedItemRemovedEmail(flaggedUser, { 
        subject: 'Prayer Request', 
        title: flaggedPrayerRequest.topic,
        flaggedHTMLList: [
            htmlTitle('Flagged Prayer Request'),
            htmlPrayerRequestBlock(flaggedPrayerRequestListItem, false)
        ]
    });
}


export const POST_prayerRequestCommentReported = async(request:JwtPrayerRequest, response:Response, next:NextFunction):Promise<void> => {
    if(request.params.prayer === undefined || isNaN(parseInt(request.params.prayer)) || request.params.comment === undefined || isNaN(parseInt(request.params.comment))) {
        next(new Exception(400, `Failed to parse prayerRequestID or commentID URL parameter :: prayer:${request.params.prayer} | comment:${request.params.comment}`, 'Missing Details'));
        return;

    } else
        response.status(200).send('Prayer Request Comment Action Reported'); // Always return success

    const prayerRequestID:number = parseInt(request.params.prayer);
    const commentID:number = parseInt(request.params.comment);
    const description:string = (typeof request.body?.description === 'string') && request.body.description.trim()
                                ? request.body.description.trim() : 'No Description Provided';

    const flaggedComment:PrayerRequestCommentListItem | undefined = await DB_SELECT_PRAYER_REQUEST_COMMENT(commentID, request.jwtUserID);
    const reportingUser:USER = await DB_SELECT_USER(new Map([['userID', request.jwtUserID]]));
    const flaggedUser:USER = await DB_SELECT_USER(new Map([['userID', flaggedComment.commenterProfile.userID]]));

    const flaggedPrayerRequest:PRAYER_REQUEST = await DB_SELECT_PRAYER_REQUEST(prayerRequestID);
    const prayerRequestOwnerUser:USER = await DB_SELECT_USER(new Map([['userID', request.jwtUserID]]));
    const flaggedPrayerRequestListItem:PrayerRequestListItem = flaggedPrayerRequest.toListItem();
    flaggedPrayerRequestListItem.requestorProfile = prayerRequestOwnerUser.toListItem();

    if(!flaggedPrayerRequest.isValid || flaggedComment === undefined || !reportingUser.isValid || !flaggedUser.isValid) {
        log.warn(`PRAYER REQUEST COMMENT REPORT FAILED - Prayer Request Comment Not Found`, `prayerRequestID=${prayerRequestID}`, `commentID=${commentID}`, `commenterUserID=${flaggedComment?.commenterProfile?.userID}`, `reportingUserID=${request.jwtUserID}`, `Event=${description}`);
        return;
    }

    const logEntry:LOG_ENTRY = new LOG_ENTRY(LogType.EVENT, [
        `PRAYER REQUEST COMMENT REPORTED - Review Required`, `Event=${description}`,
        `Flagged Prayer Request Comment: commentID=${flaggedComment.commentID}, prayerRequestID=${flaggedComment.prayerRequestID}, commenterUserID=${flaggedComment.commenterProfile.userID}, message=${flaggedComment.message}, createdDT=${flaggedComment.createdDT}`,
        `Flagged User: userID=${flaggedUser.userID}, displayName=${flaggedUser.displayName}, email=${flaggedUser.email}, modelSource=${flaggedUser.modelSourceEnvironment}`,
        `Corresponding Prayer Request: prayerRequestID=${flaggedPrayerRequest.prayerRequestID}, requestorID=${flaggedPrayerRequest.requestorID}, topic=${flaggedPrayerRequest.topic}, description=${flaggedPrayerRequest.description}, modifiedDT=${flaggedPrayerRequest.modifiedDT.toISOString()}`,
        `Reporting User: userID=${reportingUser.userID}, displayName=${reportingUser.displayName}, email=${reportingUser.email}`
    ]);
    await log.event(...logEntry.messages);

    await DB_SET_PRAYER_REQUEST_COMMENT_MODERATION(flaggedComment.commentID,  DATABASE_MODERATION_STATUS.REPORTED);
    await sendModerationEmail({
        minorInvolved: minorInvolved(flaggedUser, prayerRequestOwnerUser, reportingUser),
        reportingSubject:'PRAYER_REQUEST_COMMENT', description, reportingUser,
        flaggedHTMLList:[
            htmlTitle('Flagged Prayer Request Comment'),
            htmlPrayerRequestCommentBlock(flaggedComment, true, [['Created:', formatDate(flaggedComment.createdDT)]]),

            htmlTitle('Flagged User'),
            htmlUserContextProfile(flaggedUser),

            htmlActionButton([
                {
                    label: 'Reported User',
                    link: `${getEnv('ENVIRONMENT_BASE_URL')}/portal/edit/user/${flaggedUser.userID}`,
                    style: 'ACCENT'
                },
                {
                    label: 'Prayer Request',
                    link: `${getEnv('ENVIRONMENT_BASE_URL')}/portal/edit/prayer-request/${prayerRequestID}`,
                    style: 'PRIMARY'
                }
            ]),
        ],
        relatedHTMLList:[
            htmlTitle('Corresponding Prayer Request'),
            htmlPrayerRequestBlock(flaggedPrayerRequestListItem, true, [
                ['Created:', formatDate(flaggedPrayerRequest.createdDT)],
                ['Last Modified:', formatDate(flaggedPrayerRequest.modifiedDT)]
            ]),
        ],
        alternativeTextBody: logEntry.toString()
    });

    //Note: Decided not to notify users of comment removal
}
