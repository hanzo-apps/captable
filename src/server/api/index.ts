import { PublicAPI } from "./hono";
import { middlewareServices } from "./middlewares/services";
import { registerCompanyRoutes } from "./routes/company";

const api = PublicAPI();

api.use("*", middlewareServices());

// Register RESTful routes
registerCompanyRoutes(api);

export default api;
