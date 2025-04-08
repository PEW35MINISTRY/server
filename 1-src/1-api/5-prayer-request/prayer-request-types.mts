import { PrayerRequestCommentRequestBody, PrayerRequestPatchRequestBody, PrayerRequestPostRequestBody } from '../../0-assets/field-sync/api-type-sync/prayer-request-types.mjs';
import { JwtPrayerRequest, JwtRequest } from '../2-auth/auth-types.mjs';

/**************************************************************************************************
* SERVER SPECIFIC TYPES | PRAYER REQUEST TYPES                                                    *
* Server: Additional Types Declared in: 0-assets\field-sync\api-type-sync\prayer-request-types.ts *
***************************************************************************************************/

export interface PrayerRequestPostRequest extends JwtRequest {
    body: PrayerRequestPostRequestBody
}

export interface PrayerRequestPatchRequest extends JwtPrayerRequest {
    body: PrayerRequestPatchRequestBody
}

export interface PrayerRequestCommentRequest extends JwtPrayerRequest {
    body: PrayerRequestCommentRequestBody
}

export interface ExpiredPrayerRequestListItem {
    prayerRequestID: number,
    requestorID: number,
    topic: string,
}