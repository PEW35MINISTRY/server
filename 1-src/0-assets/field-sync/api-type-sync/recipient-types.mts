/***** ONLY DEPENDENCY:./inputField - Define all other types locally *****/
import { CircleListItem } from './circle-types.mjs'
import { ProfileListItem } from './profile-types.mjs'


/***********************************************************************
*                   PRAYER REQUEST RECIPIENT TYPES                                       *
* Sync across all repositories: server, portal, mobile                 *
************************************************************************/


export enum RecipientStatusEnum {
    NOT_SELECTED = 'NOT_SELECTED',
    CONFIRMED = 'CONFIRMED',
    UNCONFIRMED_ADD = 'UNCONFIRMED_ADD',
    UNCONFIRMED_REMOVE = 'UNCONFIRMED_REMOVE',
    
    SELECTED = 'SELECTED',
    UNSELECTED = 'UNSELECTED'
}

export interface RecipientStatusMap {
    [id:number]:RecipientStatusEnum
}

export interface RecipientStatusContext {
    userRecipientList?:ProfileListItem[], 
    circleRecipientList?:CircleListItem[], 
    addUserRecipientIDList:number[],  
    addCircleRecipientIDList:number[],
    removeUserRecipientIDList?:number[], 
    removeCircleRecipientIDList?:number[], 
}

export enum RecipientFormViewMode {
    EDITING = 'EDITING',
    CREATING = 'CREATING'
}

export interface RecipientFormCircleListItem extends CircleListItem {
    recipientStatus: RecipientStatusEnum, // flag for displaying the list item at the top of selection list
    selectionStatus?: RecipientStatusEnum
}

export interface RecipientFormProfileListItem extends ProfileListItem {
    recipientStatus: RecipientStatusEnum, // flag for displaying the list item at the top of selection list
    selectionStatus?: RecipientStatusEnum
}
