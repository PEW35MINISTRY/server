import { PartnerListItem, ProfileListItem } from "../../0-assets/field-sync/api-type-sync/profile-types.mjs";
import { PartnerStatusEnum } from "../../0-assets/field-sync/input-config-sync/profile-field-config.mjs";
import USER from "../../2-services/1-models/userModel.mjs";
import * as log from '../../2-services/10-utilities/logging/log.mjs';
import { DATABASE_PARTNER_STATUS_ENUM } from "../../2-services/2-database/database-types.mjs";
import { DB_SELECT_AVAILABLE_PARTNER_LIST, DB_ASSIGN_PARTNER_STATUS } from "../../2-services/2-database/queries/partner-queries.mjs";
import { DB_DELETE_CONTACT_CACHE_BATCH } from "../../2-services/2-database/queries/user-queries.mjs";
import { sendTemplateNotification } from "../8-notification/notification-utilities.mjs";
import { NotificationType } from "../8-notification/notification-types.mjs";


/* Auto Assign First Available Partner */
export const findAndAssignNewPartner = async(profile:USER):Promise<PartnerListItem|undefined> => {
    const availableList:ProfileListItem[] = await DB_SELECT_AVAILABLE_PARTNER_LIST(profile);
    if(availableList.length === 0)
        return undefined;

    const newPartner:PartnerListItem = {...availableList[0], status:PartnerStatusEnum.PARTNER, partnershipDT:new Date()};

    if(await DB_ASSIGN_PARTNER_STATUS(profile.userID, newPartner.userID, DATABASE_PARTNER_STATUS_ENUM.PARTNER)) {
        log.event(`Creating new partnership between ${profile.userID} and ${newPartner.userID}`);
        await DB_DELETE_CONTACT_CACHE_BATCH([profile.userID, newPartner.userID]);   

        await sendTemplateNotification(profile.userID, [profile.userID, newPartner.userID], NotificationType.PARTNERSHIP_ASSIGN);

        return newPartner;
    }

    log.error(`findAndAssignNewPartner - Failed to auto assign new partnership status for user ${profile.userID} and partner ${newPartner.userID}`);
    return undefined;
}
