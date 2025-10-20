// Unified API - automatically uses correct backend (Tauri desktop or HTTP mobile)

import * as desktopApi from './api';
import * as mobileApi from './api-mobile';

// Detect platform
const isMobile = typeof (window as any).Capacitor !== 'undefined';

console.log(`🚀 Running on: ${isMobile ? 'MOBILE' : 'DESKTOP'}`);

// Export platform detection
export { isMobile };

// Re-export types
export type {
  Identity,
  PeerInfo,
  ChatBody,
  GroupInfo,
  ConnectionStats,
  NetworkStatus,
  PeerStatus
} from './api';

// Unified API functions
export const apiGetIdentity = isMobile ? mobileApi.mobileApiGetIdentity : desktopApi.apiGetIdentity;
export const apiSetAlias = isMobile ? mobileApi.mobileApiSetAlias : desktopApi.apiSetAlias;
export const apiGetPeers = isMobile ? mobileApi.mobileApiGetPeers : desktopApi.apiGetPeers;
export const apiCreateGroup = isMobile ? mobileApi.mobileApiCreateGroup : desktopApi.apiCreateGroup;
export const apiListGroups = isMobile ? mobileApi.mobileApiListGroups : desktopApi.apiListGroups;
export const apiAddPeerMessage = isMobile ? mobileApi.mobileApiAddPeerMessage : desktopApi.apiAddPeerMessage;
export const apiAddGroupMessage = isMobile ? mobileApi.mobileApiAddGroupMessage : desktopApi.apiAddGroupMessage;
export const apiGetChatHistory = isMobile ? mobileApi.mobileApiGetChatHistory : desktopApi.apiGetChatHistory;
export const apiResetData = isMobile ? mobileApi.mobileApiResetData : desktopApi.apiResetData;
export const apiTestNetwork = isMobile ? mobileApi.mobileApiTestNetwork : desktopApi.apiTestNetwork;
export const apiGetNetworkStatus = isMobile ? mobileApi.mobileApiGetNetworkStatus : desktopApi.apiGetNetworkStatus;
export const apiRequestTcpConnection = isMobile ? mobileApi.mobileApiRequestTcpConnection : desktopApi.apiRequestTcpConnection;
export const apiHasTcpConnection = isMobile ? mobileApi.mobileApiHasTcpConnection : desktopApi.apiHasTcpConnection;
export const apiTestTcpConnection = isMobile ? desktopApi.apiTestTcpConnection : desktopApi.apiTestTcpConnection;
export const apiGetConnectionStats = isMobile ? mobileApi.mobileApiGetConnectionStats : desktopApi.apiGetConnectionStats;
export const apiUpdateAllConnectionTypes = isMobile ? desktopApi.apiUpdateAllConnectionTypes : desktopApi.apiUpdateAllConnectionTypes;
export const apiTestEncryptionWithPeer = isMobile ? desktopApi.apiTestEncryptionWithPeer : desktopApi.apiTestEncryptionWithPeer;
export const apiDeletePeerMessages = isMobile ? mobileApi.mobileApiDeletePeerMessages : desktopApi.apiDeletePeerMessages;
export const apiDeleteGroupMessages = isMobile ? mobileApi.mobileApiDeleteGroupMessages : desktopApi.apiDeleteGroupMessages;
export const apiDeleteGroup = isMobile ? desktopApi.apiDeleteGroup : desktopApi.apiDeleteGroup;
export const apiUpdateGroupName = isMobile ? mobileApi.mobileApiUpdateGroupName : desktopApi.apiUpdateGroupName;
export const apiExportMessagesToJson = isMobile ? desktopApi.apiExportMessagesToJson : desktopApi.apiExportMessagesToJson;
export const apiTestMessageSending = isMobile ? desktopApi.apiTestMessageSending : desktopApi.apiTestMessageSending;

// Mobile-specific functions
export const setBackendUrl = isMobile ? mobileApi.setBackendUrl : () => console.warn('Backend URL only for mobile');
export const getBackendUrl = isMobile ? mobileApi.getBackendUrl : () => 'Desktop (Tauri)';
export const isMobileApp = isMobile ? mobileApi.isMobileApp : () => false;
