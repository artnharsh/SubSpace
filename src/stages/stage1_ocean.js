import axios from "axios";
import { config } from "../config/environment.js";
import { logger } from "../utils/logger.js";

export async function getLookalikeCompanies(seedDomain) {
  logger.info(
    `Querying Ocean.io v3 for live lookalikes matching: "${seedDomain}"...`
  );

  try {
    const response = await axios.post(
      "https://api.ocean.io/v3/search/companies",
      {
        size: 10,
        companiesFilters: {
          lookalikeDomains: [seedDomain]
        }
      },
      {
        headers: {
          "X-Api-Token": config.oceanApiKey,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    const companies = response.data?.companies;

    if (!Array.isArray(companies)) {
      logger.error(
        "Ocean.io response schema mismatch. Expected companies array."
      );

      console.log(
        JSON.stringify(response.data, null, 2)
      );

      return [];
    }

    const domains = [
      ...new Set(
        companies
          .map(item => item?.company?.domain)
          .filter(Boolean)
      )
    ];

    logger.success(
      `Ocean.io successfully discovered ${domains.length} lookalike companies`
    );

    logger.info(
      `Domains Found: ${domains.join(", ")}`
    );

    return domains;
  } catch (error) {
    logger.error(
      `Ocean.io request failed: ${
        error.response?.status || error.message
      }`
    );

    if (error.response?.data) {
      console.log(
        JSON.stringify(error.response.data, null, 2)
      );
    }

    return [];
  }
}