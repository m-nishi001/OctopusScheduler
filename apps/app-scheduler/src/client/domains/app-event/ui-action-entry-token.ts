// UIActionEntry registry lookup token. Kept separate from `core/container`
// so that services (e.g. AppEventService) can depend on the token alone
// without importing the composition root itself, which would otherwise
// create a circular import back through any other service the container wires up.
export const UIActionEntryToken = Symbol("UIActionEntry");
