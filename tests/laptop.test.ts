import { describe, expect, it } from 'vitest';
import { changeLaptopStatus, type Laptop, type LaptopStatus } from '../src/laptop';

describe('changeLaptopStatus', () => {
    const allowed: [LaptopStatus, LaptopStatus][] = [
        ['На складе', 'Бронь'],
        ['На складе', 'Продан'],
        ['На складе', 'Списан'],
        ['Бронь', 'На складе'],
        ['Бронь', 'Продан'],
    ];

    it.each(allowed)('разрешает переход %s → %s', (from, to) => {
        const laptop: Laptop = { status: from, history: [] };
        const date = new Date('2026-10-03T12:00:00Z');

        const result = changeLaptopStatus(laptop, to, date);

        expect(result).toEqual({ ok: true });
        expect(laptop.status).toBe(to);
        expect(laptop.history).toEqual([{ from, to, date }]);
    });

    const forbidden: [LaptopStatus, LaptopStatus][] = [
        ['На складе', 'На складе'],
        ['Бронь', 'Бронь'],
        ['Бронь', 'Списан'],
        ['Продан', 'Бронь'],
        ['Продан', 'Продан'],
        ['Продан', 'Списан'],
        ['Списан', 'На складе'],
        ['Списан', 'Бронь'],
        ['Списан', 'Продан'],
        ['Списан', 'Списан'],
    ];

    it.each(forbidden)('запрещает переход %s → %s', (from, to) => {
        const laptop: Laptop = { status: from, history: [] };
        const before = structuredClone(laptop);

        const result = changeLaptopStatus(laptop, to, new Date('2026-10-03T12:00:00Z'));

        expect(result).toEqual({
            ok: false,
            error: `Переход «${from}» → «${to}» запрещён.`,
        });
        expect(laptop).toEqual(before);
    });

    it.each(['2026-10-15T11:59:59.999Z', '2026-10-15T12:00:00.000Z'])(
        'разрешает возврат в пределах срока: %s',
        (returnDate) => {
            const saleDate = new Date('2026-10-01T12:00:00Z');
            const laptop: Laptop = {
                status: 'Продан',
                history: [{ from: 'На складе', to: 'Продан', date: saleDate }],
            };
            const date = new Date(returnDate);

            const result = changeLaptopStatus(laptop, 'На складе', date);

            expect(result).toEqual({ ok: true });
            expect(laptop.status).toBe('На складе');
            expect(laptop.history).toEqual([
                { from: 'На складе', to: 'Продан', date: saleDate },
                { from: 'Продан', to: 'На складе', date },
            ]);
        },
    );

    it('запрещает возврат через 14 дней и 1 миллисекунду', () => {
        const laptop: Laptop = {
            status: 'Продан',
            history: [
                {
                    from: 'На складе',
                    to: 'Продан',
                    date: new Date('2026-10-01T12:00:00Z'),
                },
            ],
        };
        const before = structuredClone(laptop);

        const result = changeLaptopStatus(laptop, 'На складе', new Date('2026-10-15T12:00:00.001Z'));

        expect(result).toEqual({
            ok: false,
            error: 'Возврат возможен не позднее 14 дней после продажи.',
        });
        expect(laptop).toEqual(before);
    });

    it('считает срок возврата от последней продажи', () => {
        const laptop: Laptop = { status: 'На складе', history: [] };
        const firstSale = new Date('2026-09-01T12:00:00Z');
        const firstReturn = new Date('2026-09-02T12:00:00Z');
        const secondSale = new Date('2026-10-01T12:00:00Z');
        const secondReturn = new Date('2026-10-03T12:00:00Z');

        expect(changeLaptopStatus(laptop, 'Продан', firstSale)).toEqual({ ok: true });
        expect(changeLaptopStatus(laptop, 'На складе', firstReturn)).toEqual({ ok: true });
        expect(changeLaptopStatus(laptop, 'Продан', secondSale)).toEqual({ ok: true });
        expect(changeLaptopStatus(laptop, 'На складе', secondReturn)).toEqual({ ok: true });

        expect(laptop.status).toBe('На складе');
        expect(laptop.history).toEqual([
            { from: 'На складе', to: 'Продан', date: firstSale },
            { from: 'Продан', to: 'На складе', date: firstReturn },
            { from: 'На складе', to: 'Продан', date: secondSale },
            { from: 'Продан', to: 'На складе', date: secondReturn },
        ]);
    });

    it('отклоняет некорректную дату без изменения ноутбука', () => {
        const laptop: Laptop = { status: 'На складе', history: [] };
        const before = structuredClone(laptop);

        const result = changeLaptopStatus(laptop, 'Бронь', new Date(NaN));

        expect(result).toEqual({
            ok: false,
            error: 'Некорректная дата изменения статуса.',
        });
        expect(laptop).toEqual(before);
    });

    it.each([undefined, new Date(NaN)])('запрещает возврат без корректной даты продажи: %s', (saleDate) => {
        const laptop: Laptop = {
            status: 'Продан',
            history: saleDate ? [{ from: 'На складе', to: 'Продан', date: saleDate }] : [],
        };
        const before = structuredClone(laptop);

        const result = changeLaptopStatus(laptop, 'На складе', new Date('2026-10-03T12:00:00Z'));

        expect(result).toEqual({
            ok: false,
            error: 'Невозможно определить дату последней продажи.',
        });
        expect(laptop).toEqual(before);
    });

    it('запрещает возврат раньше продажи', () => {
        const laptop: Laptop = {
            status: 'Продан',
            history: [
                {
                    from: 'На складе',
                    to: 'Продан',
                    date: new Date('2026-10-03T12:00:00Z'),
                },
            ],
        };
        const before = structuredClone(laptop);

        const result = changeLaptopStatus(laptop, 'На складе', new Date('2026-10-03T11:59:59.999Z'));

        expect(result).toEqual({
            ok: false,
            error: 'Дата возврата не может быть раньше даты продажи.',
        });
        expect(laptop).toEqual(before);
    });
});
