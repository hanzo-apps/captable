-- The cap table is served by Hanzo Cloud at /v1/captable. These tables held a
-- second copy of it; the columns that pointed at them are kept and now hold the
-- id Hanzo Cloud assigned, so a document stays attached to its security.

-- DropTable
DROP TABLE IF EXISTS "Investment";

-- DropTable
DROP TABLE IF EXISTS "ConvertibleNote";

-- DropTable
DROP TABLE IF EXISTS "Safe";

-- DropTable
DROP TABLE IF EXISTS "Option";

-- DropTable
DROP TABLE IF EXISTS "Share";

-- DropTable
DROP TABLE IF EXISTS "EquityPlan";

-- DropTable
DROP TABLE IF EXISTS "ShareClass";

-- DropTable
DROP TABLE IF EXISTS "Stakeholder";

-- DropEnum
DROP TYPE IF EXISTS "ConvertibleInterestPaymentScheduleEnum";

-- DropEnum
DROP TYPE IF EXISTS "ConvertibleInterestAccrualEnum";

-- DropEnum
DROP TYPE IF EXISTS "ConvertibleInterestMethodEnum";

-- DropEnum
DROP TYPE IF EXISTS "ConvertibleTypeEnum";

-- DropEnum
DROP TYPE IF EXISTS "ConvertibleStatusEnum";

-- DropEnum
DROP TYPE IF EXISTS "SafeTemplateEnum";

-- DropEnum
DROP TYPE IF EXISTS "SafeStatusEnum";

-- DropEnum
DROP TYPE IF EXISTS "SafeTypeEnum";

-- DropEnum
DROP TYPE IF EXISTS "OptionStatusEnum";

-- DropEnum
DROP TYPE IF EXISTS "OptionTypeEnum";

-- DropEnum
DROP TYPE IF EXISTS "ShareLegendsEnum";

-- DropEnum
DROP TYPE IF EXISTS "SecuritiesStatusEnum";

-- DropEnum
DROP TYPE IF EXISTS "CancellationBehaviorEnum";

-- DropEnum
DROP TYPE IF EXISTS "ConversionRightsEnum";

-- DropEnum
DROP TYPE IF EXISTS "SharePrefixEnum";

-- DropEnum
DROP TYPE IF EXISTS "ShareTypeEnum";

-- DropEnum
DROP TYPE IF EXISTS "StakeholderRelationshipEnum";

-- DropEnum
DROP TYPE IF EXISTS "StakeholderTypeEnum";
