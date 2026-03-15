// Quick test to verify our seed data structure
const { SEED_ROUTES, SEED_POINTS, getPointsForRoute } = require('./data/seedRoutes.ts')

console.log('🧪 Testing Seed Routes Implementation\n')

// Test 1: Routes exist
console.log('📋 Available Routes:')
SEED_ROUTES.forEach(route => {
  console.log(`  ✅ ${route.title}`)
  console.log(`     Region: ${route.region}, ${route.country}`)
  console.log(`     Difficulty: ${route.difficulty}`)
  console.log(`     Price: ${route.priceUsd === 0 ? 'FREE' : `$${route.priceUsd}`}`)
  console.log(`     Duration: ${route.durationDays} days, ${route.totalNm}nm`)
  console.log(`     Points: ${getPointsForRoute(route.id).length} stops`)
  console.log('')
})

// Test 2: Points exist and are properly linked
console.log('📍 Route Points Test:')
SEED_ROUTES.forEach(route => {
  const points = getPointsForRoute(route.id)
  console.log(`  ${route.title}: ${points.length} points`)
  points.forEach((point, idx) => {
    console.log(`    ${idx + 1}. ${point.name} (${point.type}) - ${point.lat}, ${point.lng}`)
  })
  console.log('')
})

// Test 3: Filtering test
console.log('🔍 Filter Test - Easy routes:')
const easyRoutes = SEED_ROUTES.filter(r => r.difficulty === 'EASY')
easyRoutes.forEach(route => {
  console.log(`  ✅ ${route.title} (${route.difficulty})`)
})

console.log('\n🔍 Filter Test - Greek routes:')
const greekRoutes = SEED_ROUTES.filter(r => r.region.includes('Saronic') || r.country === 'Greece')
greekRoutes.forEach(route => {
  console.log(`  ✅ ${route.title} (${route.region})`)
})

// Test 4: Coordinates validation
console.log('\n🗺️ Coordinates Validation:')
SEED_ROUTES.forEach(route => {
  const points = getPointsForRoute(route.id)
  const validPoints = points.filter(p => p.lat && p.lng && p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180)
  console.log(`  ${route.title}: ${validPoints.length}/${points.length} valid coordinates`)
})

console.log('\n✅ Seed routes test completed!')