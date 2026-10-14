// ==============================================================================
// Ambient Deno & Remote Module Declarations for Supabase Edge Functions
// Provides IDE autocompletion and eliminates red squiggles in VS Code / Antigravity IDE
// ==============================================================================

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    has(key: string): boolean;
    delete(key: string): void;
    toObject(): Record<string, string>;
  }

  export const env: Env;
}

// Remote URL imports in Deno (https://...)
declare module 'https://*' {
  export function serve(handler: (req: Request) => Promise<Response> | Response, options?: any): void;
  export function createClient(supabaseUrl: string, supabaseKey: string, options?: any): any;
  const content: any;
  export default content;
}

declare module 'https://deno.land/std@*/http/server.ts' {
  export function serve(handler: (req: Request) => Promise<Response> | Response, options?: any): void;
}

declare module 'https://deno.land/std@0.177.0/http/server.ts' {
  export function serve(handler: (req: Request) => Promise<Response> | Response, options?: any): void;
}

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (req: Request) => Promise<Response> | Response, options?: any): void;
}

declare module 'https://esm.sh/@supabase/supabase-js*' {
  export function createClient(supabaseUrl: string, supabaseKey: string, options?: any): any;
}

declare module 'https://esm.sh/@supabase/supabase-js@2.39.8' {
  export function createClient(supabaseUrl: string, supabaseKey: string, options?: any): any;
}

declare module 'https://esm.sh/stripe*' {
  export default class Stripe {
    constructor(apiKey: string, config?: any);
    static createFetchHttpClient(): any;
    checkout: any;
    refunds: any;
    webhooks: any;
    [key: string]: any;
  }
}
