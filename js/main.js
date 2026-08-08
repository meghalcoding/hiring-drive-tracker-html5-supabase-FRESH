import { initAuth, initData } from "./store.js";
import { startRouter } from "./router.js";

initAuth();
initData();
startRouter();
