import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SparklineComponent } from './sparkline.component';

describe('SparklineComponent', () => {
  let fixture: ComponentFixture<SparklineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SparklineComponent] }).compileComponents();
    fixture = TestBed.createComponent(SparklineComponent);
  });

  function render(values: number[]): HTMLElement {
    fixture.componentRef.setInput('values', values);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders a placeholder when there is nothing to draw', () => {
    expect(render([]).querySelector('svg')).toBeNull();
    expect(render([]).querySelector('.spark--empty')).not.toBeNull();
  });

  it('needs at least two points before drawing a line', () => {
    expect(render([100]).querySelector('svg')).toBeNull();
  });

  it('draws a path once there are two points', () => {
    const path = render([100, 110]).querySelector('.spark__line');
    expect(path?.getAttribute('d')).toMatch(/^M0\.00,/);
  });

  it('puts the highest value above the lowest', () => {
    const d = render([100, 200]).querySelector('.spark__line')!.getAttribute('d')!;
    const ys = [...d.matchAll(/,(\d+\.\d+)/g)].map((m) => Number(m[1]));
    expect(ys[1]).toBeLessThan(ys[0]);
  });

  it('handles a perfectly flat series without dividing by zero', () => {
    const d = render([50, 50, 50]).querySelector('.spark__line')!.getAttribute('d')!;
    expect(d).not.toContain('NaN');
  });

  it('closes the fill path back to the baseline', () => {
    const d = render([100, 120, 90]).querySelector('.spark__fill')!.getAttribute('d')!;
    expect(d.endsWith('L0,60 Z')).toBeTrue();
  });

  it('is hidden from assistive technology', () => {
    expect(render([1, 2]).querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
