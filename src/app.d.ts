import type { Player } from './lib/server/domain';
declare global {
	namespace App {
		interface Locals {
			player: Player | null;
			admin: { id: string; email: string; name: string } | null;
			barNetwork: boolean;
			networkDiagnostic?: import('./lib/server/network').NetworkDiagnostic;
		}
	}
}
export {};
