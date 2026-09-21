import { auth } from "@engine/auth";
export const openSession = () => auth.login();
export const closeSession = () => auth.logout();
export const hasSession = () => auth.loggedIn();
