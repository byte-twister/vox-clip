const CONTEXT_MENU_ID = "voxclip-read-selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "Read with VoxClip",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) return;

  chrome.tabs.sendMessage(tab.id, {
    type: "VOXCLIP_READ_TEXT",
    text: (info.selectionText || "").trim(),
    source: "context-menu"
  });
});
