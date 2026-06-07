const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  info: '\x1b[36m',    // Cyan
  success: '\x1b[32m', // Green
  warn: '\x1b[33m',    // Yellow
  error: '\x1b[31m',   // Red
  stage: '\x1b[35m'    // Magenta
};

export const logger = {
  stage: (stageNumber, title) => {
    console.log(`\n${COLORS.stage}${COLORS.bright}=== [STAGE ${stageNumber}] ${title.toUpperCase()} ===${COLORS.reset}`);
  },
  
  info: (message) => {
    console.log(`${COLORS.info}[INFO]${COLORS.reset} ${message}`);
  },
  
  success: (message) => {
    console.log(`${COLORS.success}✔ [SUCCESS]${COLORS.reset} ${message}`);
  },
  
  warn: (message) => {
    console.log(`${COLORS.warn}⚠ [WARN]${COLORS.reset} ${message}`);
  },
  
  error: (message, errorObject = null) => {
    console.error(`${COLORS.error}✘ [ERROR]${COLORS.reset} ${message}`);
    if (errorObject && errorObject.message) {
      console.error(`${COLORS.dim}  Reason: ${errorObject.message}${COLORS.reset}`);
    }
  },

  divider: () => {
    console.log(`${COLORS.dim}------------------------------------------------------------${COLORS.reset}`);
  }
};