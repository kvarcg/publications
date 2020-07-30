#line 2
// Non-Indexed Versions
struct NodeTypeDataLL
{
	float	depth;
	uint	next;

	uint	albedo;
	uint	normal;
	uint	specular;
	uint	ior_opacity;
};

struct NodeTypeDataLL_Double
{
	float	depth;

	uint	albedo;
	uint	normal;
	uint	specular;
	uint	ior_opacity;

	uint	next;
	uint	prev;
};

struct NodeTypeDataSB
{
	uvec4 data;
//	float depth;

//	uint	depth;
	//uint	albedo;
	//uint	normal;
	//uint	specular;
};

// Indexed Versions
// NodeTypeData (Attributes)
struct NodeTypeData
{
	uint	albedo;
	uint	normal;
	uint	specular;
	uint	ior_opacity;
};

// ID Buffers
struct NodeTypeSB
{
	float	depth;
	uint	index;
};

struct NodeTypeLL
{
	float	depth;
	uint	next;
};

struct NodeTypeLL_Double
{
	float	depth;

	uint next;
	uint prev;
};

// NodeTypeDataAB (All)
struct NodeTypeDataMB
{
	uint	illumination;

	float	time_delta;
};
