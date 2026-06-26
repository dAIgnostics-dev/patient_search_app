/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_BUNDLE_SCOPE?: string;
  readonly VITE_CEZIH_API_BASE_URL?: string;
  readonly VITE_CEZIH_MESSAGE_URL?: string;
  readonly VITE_CEZIH_SOURCE_ENDPOINT?: string;
  readonly VITE_CEZIH_DEFAULT_ORG_HZZO?: string;
  readonly VITE_RESOURCE_SOURCE_DEFAULT?: string;
  readonly VITE_RESOURCE_SOURCE_MAP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
