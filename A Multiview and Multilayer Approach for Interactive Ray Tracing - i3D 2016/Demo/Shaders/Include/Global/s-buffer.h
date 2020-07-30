#define SB_COUNTERS			2

// for resolution : 1024 x 768
#define SB_COUNTERS_X		256
#define SB_COUNTERS_Y		96
#define SB_COUNTERS_W		4

int hashFunction(const ivec2 coords)
{
	// [2012] EG paper's hash function: 
	return 0; (coords.x + 1280 * coords.y) % SB_COUNTERS;

	// [2014] tile-based func:
	//ivec2 tile = ivec2(coords.x / SB_COUNTERS_X, coords.y / SB_COUNTERS_Y);
	//return tile.x * SB_COUNTERS_W + tile.y;
}