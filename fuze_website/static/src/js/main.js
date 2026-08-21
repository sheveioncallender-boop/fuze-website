(() => {
  const header = document.getElementById('siteHeader');
  const menuToggle = document.getElementById('menuToggle');
  const mobileNav = document.getElementById('mobileNav');
  const year = document.getElementById('year');

  year.textContent = new Date().getFullYear();

  const syncMobileNavPosition = () => {
    document.documentElement.style.setProperty('--mobile-nav-top', `${Math.max(0, header.getBoundingClientRect().bottom)}px`);
  };

  const syncHeader = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 10);
    syncMobileNavPosition();
  };
  syncHeader();
  window.addEventListener('scroll', syncHeader, { passive: true });
  window.addEventListener('resize', syncMobileNavPosition, { passive: true });

  const closeMenu = () => {
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation');
    mobileNav.classList.remove('is-open');
    document.body.classList.remove('nav-open');
  };

  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
    mobileNav.classList.toggle('is-open', !isOpen);
    document.body.classList.toggle('nav-open', !isOpen);
  });

  mobileNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

  const slideButtons = [...document.querySelectorAll('[data-slide]')];
  const slideCopy = [...document.querySelectorAll('[data-slide-copy]')];
  const slideImages = [...document.querySelectorAll('[data-slide-image]')];
  const price = document.querySelector('[data-price]');
  const priceLabel = document.querySelector('[data-price-label]');
  const chipOne = document.querySelector('[data-chip-one]');
  const chipTwo = document.querySelector('[data-chip-two]');
  const slideData = [
    { price: '$85', label: 'Match day meal', chipOne: 'Wahoo fish', chipTwo: 'Cassava sticks' },
    { price: '$25', label: 'Two empanadas', chipOne: 'Baked golden', chipTwo: 'Signature sauce' }
  ];
  let currentSlide = 0;
  let slideTimer;

  const setSlide = (index) => {
    currentSlide = index;
    slideButtons.forEach((button, i) => button.classList.toggle('is-active', i === index));
    slideCopy.forEach((copy, i) => copy.classList.toggle('is-active', i === index));
    slideImages.forEach((image, i) => image.classList.toggle('is-active', i === index));
    price.textContent = slideData[index].price;
    priceLabel.textContent = slideData[index].label;
    chipOne.textContent = slideData[index].chipOne;
    chipTwo.textContent = slideData[index].chipTwo;
  };

  const startSlides = () => {
    window.clearInterval(slideTimer);
    slideTimer = window.setInterval(() => setSlide((currentSlide + 1) % slideData.length), 6500);
  };

  slideButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setSlide(Number(button.dataset.slide));
      startSlides();
    });
  });

  if (slideButtons.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) startSlides();

  const reveals = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  reveals.forEach((element) => observer.observe(element));

  document.querySelectorAll('.menu-filter button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.menu-filter button').forEach((item) => {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-selected', String(active));
      });
    });
  });

  const reelViewport = document.getElementById('reelViewport');
  if (reelViewport) {
    const reelCards = [...reelViewport.querySelectorAll('[data-reel-card]')];
    const reelDots = [...document.querySelectorAll('[data-reel-dot]')];
    const previousReel = document.querySelector('[data-reel-prev]');
    const nextReel = document.querySelector('[data-reel-next]');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let reelIndex = 0;
    let reelTimer;
    let reelScrollTimer;

    const updateVideoButton = (card) => {
      const video = card.querySelector('video');
      const button = card.querySelector('[data-reel-play]');
      const playing = !video.paused;
      button.textContent = playing ? 'Ⅱ' : '▶';
      button.classList.toggle('is-playing', playing);
      button.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${card.querySelector('h3').textContent.toLowerCase()} video`);
    };

    const setActiveReel = (index) => {
      reelIndex = (index + reelCards.length) % reelCards.length;
      reelCards.forEach((card, cardIndex) => card.classList.toggle('is-active', cardIndex === reelIndex));
      reelDots.forEach((dot, dotIndex) => {
        const active = dotIndex === reelIndex;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-current', active ? 'true' : 'false');
      });
    };

    const goToReel = (index, behavior = 'smooth') => {
      const nextIndex = (index + reelCards.length) % reelCards.length;
      const card = reelCards[nextIndex];
      const left = reelViewport.scrollLeft + card.getBoundingClientRect().left - reelViewport.getBoundingClientRect().left;
      setActiveReel(nextIndex);
      reelViewport.scrollTo({ left, behavior });
    };

    const stopReelTimer = () => window.clearInterval(reelTimer);
    const startReelTimer = () => {
      stopReelTimer();
      if (reduceMotion) return;
      reelTimer = window.setInterval(() => goToReel(reelIndex + 1), 7000);
    };

    previousReel.addEventListener('click', () => { goToReel(reelIndex - 1); startReelTimer(); });
    nextReel.addEventListener('click', () => { goToReel(reelIndex + 1); startReelTimer(); });
    reelDots.forEach((dot) => dot.addEventListener('click', () => { goToReel(Number(dot.dataset.reelDot)); startReelTimer(); }));

    reelCards.forEach((card) => {
      const video = card.querySelector('video');
      const playButton = card.querySelector('[data-reel-play]');
      const soundButton = card.querySelector('[data-reel-sound]');

      const togglePlayback = () => {
        if (video.paused) video.play().catch(() => {});
        else video.pause();
        window.setTimeout(() => updateVideoButton(card), 0);
      };

      playButton.addEventListener('click', togglePlayback);
      video.addEventListener('click', togglePlayback);
      video.addEventListener('play', () => updateVideoButton(card));
      video.addEventListener('pause', () => updateVideoButton(card));

      soundButton.addEventListener('click', () => {
        const shouldEnable = video.muted;
        reelCards.forEach((otherCard) => {
          const otherVideo = otherCard.querySelector('video');
          const otherButton = otherCard.querySelector('[data-reel-sound]');
          otherVideo.muted = true;
          otherButton.setAttribute('aria-pressed', 'false');
          otherButton.textContent = 'Sound off';
        });
        video.muted = !shouldEnable;
        soundButton.setAttribute('aria-pressed', String(shouldEnable));
        soundButton.textContent = shouldEnable ? 'Sound on' : 'Sound off';
        if (shouldEnable) {
          video.play().catch(() => {});
          stopReelTimer();
        } else {
          startReelTimer();
        }
      });
    });

    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const card = entry.target;
        const video = card.querySelector('video');
        if (entry.isIntersecting && !reduceMotion) video.play().catch(() => {});
        else video.pause();
      });
    }, { root: reelViewport, threshold: .55 });
    reelCards.forEach((card) => videoObserver.observe(card));

    reelViewport.addEventListener('scroll', () => {
      window.clearTimeout(reelScrollTimer);
      reelScrollTimer = window.setTimeout(() => {
        const viewportLeft = reelViewport.getBoundingClientRect().left;
        const closestIndex = reelCards.reduce((best, card, index) => {
          const distance = Math.abs(card.getBoundingClientRect().left - viewportLeft);
          return distance < best.distance ? { index, distance } : best;
        }, { index: 0, distance: Number.POSITIVE_INFINITY }).index;
        setActiveReel(closestIndex);
      }, 90);
    }, { passive: true });

    reelViewport.addEventListener('mouseenter', stopReelTimer);
    reelViewport.addEventListener('mouseleave', startReelTimer);
    reelViewport.addEventListener('focusin', stopReelTimer);
    reelViewport.addEventListener('focusout', startReelTimer);
    reelViewport.addEventListener('touchstart', stopReelTimer, { passive: true });
    reelViewport.addEventListener('touchend', startReelTimer, { passive: true });
    const reelSectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) startReelTimer();
        else stopReelTimer();
      });
    }, { threshold: .15 });
    reelSectionObserver.observe(reelViewport.closest('.reel-section'));
    setActiveReel(0);
  }

  document.querySelectorAll('[data-story-video]').forEach((story) => {
    const video = story.querySelector('video');
    const soundButton = story.querySelector('[data-story-sound]');
    if (!video || !soundButton) return;

    const syncStorySound = () => {
      const soundOn = !video.muted;
      soundButton.textContent = soundOn ? 'Sound on' : 'Sound off';
      soundButton.setAttribute('aria-pressed', String(soundOn));
      soundButton.setAttribute('aria-label', soundOn ? 'Mute kitchen video' : 'Play kitchen video with sound');
    };

    soundButton.addEventListener('click', () => {
      video.muted = !video.muted;
      if (!video.muted) video.play().catch(() => {});
      syncStorySound();
    });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.autoplay = false;
      video.pause();
    }
    syncStorySound();
  });

  const locationMap = document.querySelector('[data-location-map]');
  if (locationMap) {
    const locationSelectors = [...document.querySelectorAll('[data-location-select]')];
    const locationPins = [...document.querySelectorAll('[data-map-pin]')];
    const locationPanels = [...document.querySelectorAll('[data-location-panel]')];
    const mapStatus = locationMap.querySelector('[data-map-status]');
    const zoomIn = locationMap.querySelector('[data-map-zoom-in]');
    const zoomOut = locationMap.querySelector('[data-map-zoom-out]');
    const resetMap = locationMap.querySelector('[data-map-reset]');
    const locationLabels = {
      east: 'East Gates Mall · Trincity',
      bagshot: 'Bagshot BoxPark · Maraval'
    };
    let mapZoom = 0;

    const setMapZoom = (nextZoom) => {
      mapZoom = Math.max(0, Math.min(2, nextZoom));
      locationMap.dataset.zoom = String(mapZoom);
      zoomOut.disabled = mapZoom === 0;
      zoomIn.disabled = mapZoom === 2;
    };

    const setLocation = (location) => {
      locationMap.dataset.activeLocation = location;
      mapStatus.textContent = locationLabels[location];
      locationSelectors.forEach((button) => {
        const active = button.dataset.locationSelect === location;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      locationPins.forEach((pin) => pin.classList.toggle('is-active', pin.dataset.mapPin === location));
      locationPanels.forEach((panel) => {
        const active = panel.dataset.locationPanel === location;
        panel.hidden = !active;
        panel.classList.toggle('is-active', active);
      });
    };

    locationSelectors.forEach((button) => button.addEventListener('click', () => setLocation(button.dataset.locationSelect)));
    locationPins.forEach((pin) => pin.addEventListener('click', () => setLocation(pin.dataset.mapPin)));
    zoomIn.addEventListener('click', () => setMapZoom(mapZoom + 1));
    zoomOut.addEventListener('click', () => setMapZoom(mapZoom - 1));
    resetMap.addEventListener('click', () => setMapZoom(0));
    setMapZoom(0);
    setLocation(locationMap.dataset.activeLocation || 'east');
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });
})();
