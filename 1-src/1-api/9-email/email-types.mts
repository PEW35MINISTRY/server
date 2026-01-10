import { JwtClientRequest } from "../2-auth/auth-types.mjs"


export interface EmailReportRequest extends JwtClientRequest {
    params:JwtClientRequest['params'] & {
        type:string,
    },
    query: {
        email?:string
    }
}
