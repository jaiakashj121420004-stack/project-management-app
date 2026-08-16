import { describe, it, expect } from 'vitest';
import { POSITION_STEP } from '@/lib/ordering';
import { sequentialPositions } from './templatePositions';

describe('sequentialPositions', () => {
  it('returns an empty array for zero items', () => {
    expect(sequentialPositions(0)).toEqual([]);
  });

  it('spaces positions by POSITION_STEP, matching seed_project_columns()', () => {
    expect(sequentialPositions(3)).toEqual([POSITION_STEP, POSITION_STEP * 2, POSITION_STEP * 3]);
  });

  it('produces strictly ascending positions for a larger count', () => {
    const positions = sequentialPositions(10);
    expect(positions).toHaveLength(10);
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]!);
    }
  });
});
