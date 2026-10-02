import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { M as Monitor } from './Monitor-CMsA6eLb.mjs';

declare class NestJSPulseInterceptor implements NestInterceptor {
    private readonly monitor;
    constructor(monitor: Monitor);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
}

export { NestJSPulseInterceptor };
