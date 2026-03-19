import neo4j, { type Driver } from "neo4j-driver";
import { getConfig } from "../config.ts";

let _driver: Driver | null = null;

export function getDriver(): Driver {
	if (!_driver) {
		const config = getConfig();
		_driver = neo4j.driver(
			config.neo4j.uri,
			neo4j.auth.basic(config.neo4j.user, config.neo4j.password),
			{
				maxConnectionLifetime: 30 * 60 * 1000,
				maxConnectionPoolSize: 20,
				disableLosslessIntegers: true,
			},
		);
	}
	return _driver;
}

export function neo4jClient() {
	return getDriver();
}

export async function closeDriver(): Promise<void> {
	if (_driver) {
		await _driver.close();
		_driver = null;
	}
}
