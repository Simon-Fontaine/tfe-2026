// ─── Types ────────────────────────────────────────────────────────────────────

export type OW2Role = "tank" | "damage" | "support";

export type OW2Rank =
	| "bronze"
	| "silver"
	| "gold"
	| "platinum"
	| "diamond"
	| "master"
	| "grandmaster"
	| "champion";

// ─── Roles ────────────────────────────────────────────────────────────────────

export interface RoleMeta {
	id: OW2Role;
	label: string;
	description: string;
	/** Canonical hex color for this role. */
	color: string;
	/** Pre-built Tailwind classes for a toggle-button selector. */
	buttonClass: string;
	/** Pre-built Tailwind classes for a display badge (no border). */
	badgeClass: string;
}

export const ROLES: RoleMeta[] = [
	{
		id: "tank",
		label: "Tank",
		description: "Frontline anchor",
		color: "#4B91D4",
		buttonClass:
			"border-border bg-[#4B91D4]/10 hover:bg-[#4B91D4]/20 data-[selected=true]:border-[#4B91D4] data-[selected=true]:bg-[#4B91D4]/25",
		badgeClass: "bg-[#4B91D4]/15 text-[#4B91D4]",
	},
	{
		id: "damage",
		label: "Damage",
		description: "Eliminate threats",
		color: "#D45555",
		buttonClass:
			"border-border bg-[#D45555]/10 hover:bg-[#D45555]/20 data-[selected=true]:border-[#D45555] data-[selected=true]:bg-[#D45555]/25",
		badgeClass: "bg-[#D45555]/15 text-[#D45555]",
	},
	{
		id: "support",
		label: "Support",
		description: "Enable your team",
		color: "#4CA651",
		buttonClass:
			"border-border bg-[#4CA651]/10 hover:bg-[#4CA651]/20 data-[selected=true]:border-[#4CA651] data-[selected=true]:bg-[#4CA651]/25",
		badgeClass: "bg-[#4CA651]/15 text-[#4CA651]",
	},
];

export const ROLE_META = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<
	OW2Role,
	RoleMeta
>;

// ─── Ranks ────────────────────────────────────────────────────────────────────

export interface RankMeta {
	id: OW2Rank;
	label: string;
	/** Canonical hex color for this rank. */
	color: string;
	/** Pre-built Tailwind classes for a toggle-button selector. */
	buttonClass: string;
	/** Pre-built Tailwind classes for a display badge (outline variant). */
	badgeClass: string;
}

export const RANKS: RankMeta[] = [
	{
		id: "bronze",
		label: "Bronze",
		color: "#A97951",
		buttonClass:
			"border-border bg-[#A97951]/15 hover:bg-[#A97951]/25 data-[selected=true]:border-[#A97951] data-[selected=true]:bg-[#A97951]/30",
		badgeClass: "border-[#A97951]/50 bg-[#A97951]/15 text-[#A97951]",
	},
	{
		id: "silver",
		label: "Silver",
		color: "#D1D1D1",
		buttonClass:
			"border-border bg-[#D1D1D1]/10 hover:bg-[#D1D1D1]/20 data-[selected=true]:border-[#D1D1D1] data-[selected=true]:bg-[#D1D1D1]/25",
		badgeClass: "border-[#D1D1D1]/50 bg-[#D1D1D1]/15 text-[#D1D1D1]",
	},
	{
		id: "gold",
		label: "Gold",
		color: "#F5D657",
		buttonClass:
			"border-border bg-[#F5D657]/10 hover:bg-[#F5D657]/20 data-[selected=true]:border-[#F5D657] data-[selected=true]:bg-[#F5D657]/25",
		badgeClass: "border-[#F5D657]/50 bg-[#F5D657]/15 text-[#F5D657]",
	},
	{
		id: "platinum",
		label: "Platinum",
		color: "#43E2C4",
		buttonClass:
			"border-border bg-[#43E2C4]/10 hover:bg-[#43E2C4]/20 data-[selected=true]:border-[#43E2C4] data-[selected=true]:bg-[#43E2C4]/25",
		badgeClass: "border-[#43E2C4]/50 bg-[#43E2C4]/15 text-[#43E2C4]",
	},
	{
		id: "diamond",
		label: "Diamond",
		color: "#75A5FF",
		buttonClass:
			"border-border bg-[#75A5FF]/10 hover:bg-[#75A5FF]/20 data-[selected=true]:border-[#75A5FF] data-[selected=true]:bg-[#75A5FF]/25",
		badgeClass: "border-[#75A5FF]/50 bg-[#75A5FF]/15 text-[#75A5FF]",
	},
	{
		id: "master",
		label: "Master",
		color: "#E068F5",
		buttonClass:
			"border-border bg-[#E068F5]/10 hover:bg-[#E068F5]/20 data-[selected=true]:border-[#E068F5] data-[selected=true]:bg-[#E068F5]/25",
		badgeClass: "border-[#E068F5]/50 bg-[#E068F5]/15 text-[#E068F5]",
	},
	{
		id: "grandmaster",
		label: "Grandmaster",
		color: "#FF5050",
		buttonClass:
			"border-border bg-[#FF5050]/10 hover:bg-[#FF5050]/20 data-[selected=true]:border-[#FF5050] data-[selected=true]:bg-[#FF5050]/25",
		badgeClass: "border-[#FF5050]/50 bg-[#FF5050]/15 text-[#FF5050]",
	},
	{
		id: "champion",
		label: "Champion",
		color: "#FFB020",
		buttonClass:
			"border-border bg-[#FFB020]/10 hover:bg-[#FFB020]/20 data-[selected=true]:border-[#FFB020] data-[selected=true]:bg-[#FFB020]/25",
		badgeClass: "border-[#FFB020]/50 bg-[#FFB020]/15 text-[#FFB020]",
	},
];

export const RANK_META = Object.fromEntries(RANKS.map((r) => [r.id, r])) as Record<
	OW2Rank,
	RankMeta
>;
