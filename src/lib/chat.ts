"use client";

export type ChatStatus = "loading" | "online" | "away" | "offline" | "unavailable";
export const CHAT_REQUEST = "fw-chat-request";
export const CHAT_CHANGE = "fw-chat-change";
let status: ChatStatus = "loading";

export function getChatStatus() { return status; }
export function publishChatStatus(value: ChatStatus) {
  status = value;
  window.dispatchEvent(new Event(CHAT_CHANGE));
}
export function subscribeChat(callback: () => void) {
  window.addEventListener(CHAT_CHANGE, callback);
  return () => window.removeEventListener(CHAT_CHANGE, callback);
}
export function requestChat() {
  window.dispatchEvent(new Event(CHAT_REQUEST));
}
