export type LaptopStatus = 'На складе' | 'Бронь' | 'Продан' | 'Списан';

export interface StatusChange {
    from: LaptopStatus;
    to: LaptopStatus;
    date: Date;
}

export interface Laptop {
    status: LaptopStatus;
    history: StatusChange[];
}

const allowedTransitions: Record<LaptopStatus, readonly LaptopStatus[]> = {
    'На складе': ['Бронь', 'Продан', 'Списан'],
    Бронь: ['На складе', 'Продан'],
    Продан: ['На складе'],
    Списан: [],
};

const RETURN_PERIOD_MS = 14 * 24 * 60 * 60 * 1000;

export type ChangeStatusResult = { ok: true } | { ok: false; error: string };

export function changeLaptopStatus(
    laptop: Laptop,
    nextStatus: LaptopStatus,
    date: Date = new Date(),
): ChangeStatusResult {
    if (!allowedTransitions[laptop.status].includes(nextStatus)) {
        return {
            ok: false,
            error: `Переход «${laptop.status}» → «${nextStatus}» запрещён.`,
        };
    }

    const timestamp = date.getTime();

    if (!Number.isFinite(timestamp)) {
        return { ok: false, error: 'Некорректная дата изменения статуса.' };
    }

    if (laptop.status === 'Продан') {
        const lastSale = [...laptop.history].reverse().find((entry) => entry.to === 'Продан');

        if (!lastSale || !Number.isFinite(lastSale.date.getTime())) {
            return {
                ok: false,
                error: 'Невозможно определить дату последней продажи.',
            };
        }

        const elapsed = timestamp - lastSale.date.getTime();

        if (elapsed < 0) {
            return {
                ok: false,
                error: 'Дата возврата не может быть раньше даты продажи.',
            };
        }

        if (elapsed > RETURN_PERIOD_MS) {
            return {
                ok: false,
                error: 'Возврат возможен не позднее 14 дней после продажи.',
            };
        }
    }

    laptop.history.push({
        from: laptop.status,
        to: nextStatus,
        date: new Date(timestamp),
    });
    laptop.status = nextStatus;

    return { ok: true };
}
