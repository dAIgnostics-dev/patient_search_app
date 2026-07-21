/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_AUTH_API_URL?: string;
  readonly VITE_AUDIT_API_URL?: string;
  readonly VITE_BUNDLE_SCOPE?: string;
  readonly VITE_CEZIH_API_BASE_URL?: string;
  readonly VITE_CEZIH_MESSAGE_URL?: string;
  readonly VITE_CEZIH_SOURCE_ENDPOINT?: string;
  readonly VITE_CEZIH_DEFAULT_ORG_HZZO?: string;
  readonly VITE_CEZIH_MHD_URL?: string;
  readonly VITE_DOCUMENT_EDIT_WINDOW_MS?: string;
  readonly VITE_LOM_NOTIFICATION_URL?: string;
  readonly VITE_RESOURCE_SOURCE_DEFAULT?: string;
  readonly VITE_RESOURCE_SOURCE_MAP?: string;
  readonly VITE_TERMINOLOGY_PROVIDER?: string;
  readonly VITE_CARD_READER_BRIDGE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
