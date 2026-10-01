#!/usr/bin/env node

/**
 * Measurement script for SpaceWheelOutro centring diagnosis.
 * Run in dev console at various viewport widths.
 */

const widths = [375, 390, 412, 768, 1440, 1920, 2560];

function measureCentring() {
  const results = [];
  const section = document.querySelector('[data-outro-section]');
  if (!section) {
    console.error('Section not found');
    return;
  }

  const vw = document.documentElement.clientWidth;
  const centre = vw / 2;

  // Closing band elements
  const band = section.querySelector('[data-outro-band]');
  const headlineGroup = section.querySelector('[data-outro-headline-group]');
  const headline = section.querySelector('[data-outro-headline-chars]');
  const echo1 = section.querySelector('[data-outro-echo="1"]');
  const echo2 = section.querySelector('[data-outro-echo="2"]');
  const ballScroll = section.querySelector('[data-outro-ball-scroll]');
  const desc = section.querySelector('[data-outro-desc]');
  const steps = section.querySelector('[data-outro-steps]');
  const buttons = section.querySelector('[data-outro-buttons]');

  function getOffset(el) {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const elCentre = rect.left + rect.width / 2;
    return Math.round(elCentre - centre);
  }

  results.push({
    width: vw,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    elements: {
      'Band': getOffset(band),
      'Headline group': getOffset(headlineGroup),
      'Headline': getOffset(headline),
      'Echo 1': getOffset(echo1),
      'Echo 2': getOffset(echo2),
      'Ball': getOffset(ballScroll),
      'Description': getOffset(desc),
      'Steps': getOffset(steps),
      'Buttons': getOffset(buttons),
    }
  });

  // Check for 獨立空間 section
  const aboutContent = document.querySelector('[data-about-content]');
  if (aboutContent) {
    // Find section with heading 獨立空間
    const allSections = aboutContent.querySelectorAll('section');
    for (const sec of allSections) {
      const h2 = sec.querySelector('h2');
      if (h2 && h2.textContent.includes('獨立空間')) {
        const heading = h2;
        const caption = sec.querySelector('p');
        const photos = sec.querySelectorAll('img, [data-photo]');

        results.push({
          section: '獨立空間',
          heading: getOffset(heading),
          caption: getOffset(caption),
          photo1: photos[0] ? getOffset(photos[0]) : null,
          photo2: photos[1] ? getOffset(photos[1]) : null,
        });
        break;
      }
    }
  }

  console.table(results);
  return results;
}

// For manual console use
if (typeof window !== 'undefined') {
  window.measureCentring = measureCentring;
  console.log('Run measureCentring() at each viewport width');
}

export { measureCentring };
