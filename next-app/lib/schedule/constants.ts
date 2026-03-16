import type { AvailabilityRow } from "@/lib/data/player";

export const DAYS = [
	{ value: 1, label: "Mon" },
	{ value: 2, label: "Tue" },
	{ value: 3, label: "Wed" },
	{ value: 4, label: "Thu" },
	{ value: 5, label: "Fri" },
	{ value: 6, label: "Sat" },
	{ value: 0, label: "Sun" },
];

export const COMMON_TIMEZONES = [
	"UTC",
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"America/Phoenix",
	"America/Anchorage",
	"Pacific/Honolulu",
	"America/Toronto",
	"America/Vancouver",
	"America/Sao_Paulo",
	"America/Argentina/Buenos_Aires",
	"America/Mexico_City",
	"Europe/London",
	"Europe/Dublin",
	"Europe/Lisbon",
	"Europe/Paris",
	"Europe/Berlin",
	"Europe/Rome",
	"Europe/Madrid",
	"Europe/Amsterdam",
	"Europe/Brussels",
	"Europe/Zurich",
	"Europe/Stockholm",
	"Europe/Oslo",
	"Europe/Warsaw",
	"Europe/Prague",
	"Europe/Budapest",
	"Europe/Vienna",
	"Europe/Copenhagen",
	"Europe/Helsinki",
	"Europe/Athens",
	"Europe/Bucharest",
	"Europe/Moscow",
	"Europe/Istanbul",
	"Europe/Kyiv",
	"Asia/Dubai",
	"Asia/Kolkata",
	"Asia/Karachi",
	"Asia/Dhaka",
	"Asia/Bangkok",
	"Asia/Singapore",
	"Asia/Hong_Kong",
	"Asia/Shanghai",
	"Asia/Tokyo",
	"Asia/Seoul",
	"Australia/Perth",
	"Australia/Brisbane",
	"Australia/Sydney",
	"Australia/Melbourne",
	"Pacific/Auckland",
	"Pacific/Fiji",
];

export function formatWindowTitle(row: AvailabilityRow): string {
	if (row.dayOfWeek !== null && row.dayOfWeek !== undefined) {
		const day = DAYS.find((d) => d.value === row.dayOfWeek);
		return day ? day.label : `Day ${row.dayOfWeek}`;
	}
	if (row.specificDate) {
		return new Date(row.specificDate).toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}
	return "Window";
}
