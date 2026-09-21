// Replace this adapter with a real authentication provider when connecting a server.
export const auth = {
  loggedIn: () => localStorage.getItem("teachway-demo") === "true",
  login: () => localStorage.setItem("teachway-demo", "true"),
  logout: () => localStorage.removeItem("teachway-demo"),
};
