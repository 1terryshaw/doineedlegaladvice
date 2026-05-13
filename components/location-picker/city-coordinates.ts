// Static city center coordinates for "Near you" haversine calculation
// Key format: "PROVINCE_CODE:city-slug"
export const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // ─── CANADA ───────────────────────────────────────────────────────────────────

  // Ontario
  "ON:london": { lat: 42.9849, lng: -81.2453 },
  "ON:toronto": { lat: 43.6532, lng: -79.3832 },
  "ON:mississauga": { lat: 43.5890, lng: -79.6441 },
  "ON:richmond-hill": { lat: 43.8828, lng: -79.4403 },
  "ON:brampton": { lat: 43.7315, lng: -79.7624 },
  "ON:vaughan": { lat: 43.8361, lng: -79.4983 },
  "ON:windsor": { lat: 42.3149, lng: -83.0364 },
  "ON:ottawa": { lat: 45.4215, lng: -75.6972 },
  "ON:kingston": { lat: 44.2312, lng: -76.4860 },
  "ON:oakville": { lat: 43.4675, lng: -79.6877 },
  "ON:st-catharines": { lat: 43.1594, lng: -79.2469 },
  "ON:burlington": { lat: 43.3255, lng: -79.7990 },
  "ON:barrie": { lat: 44.3894, lng: -79.6903 },
  "ON:waterloo": { lat: 43.4643, lng: -80.5204 },
  "ON:oshawa": { lat: 43.8971, lng: -78.8658 },
  "ON:hamilton": { lat: 43.2557, lng: -79.8711 },
  "ON:markham": { lat: 43.8561, lng: -79.3370 },
  "ON:guelph": { lat: 43.5448, lng: -80.2482 },
  "ON:cambridge": { lat: 43.3616, lng: -80.3144 },
  "ON:kitchener": { lat: 43.4516, lng: -80.4925 },
  "ON:thunder-bay": { lat: 48.3809, lng: -89.2477 },
  "ON:peterborough": { lat: 44.3091, lng: -78.3197 },
  "ON:niagara-falls": { lat: 43.0896, lng: -79.0849 },
  "ON:brantford": { lat: 43.1394, lng: -80.2644 },
  "ON:whitby": { lat: 43.8975, lng: -78.9429 },
  "ON:pickering": { lat: 43.8384, lng: -79.0868 },
  "ON:newmarket": { lat: 44.0592, lng: -79.4613 },
  "ON:greater-sudbury": { lat: 46.4917, lng: -80.9930 },
  "ON:milton": { lat: 43.5183, lng: -79.8774 },
  "ON:ajax": { lat: 43.8509, lng: -79.0204 },
  "ON:sudbury": { lat: 46.4917, lng: -80.9930 },
  "ON:aurora": { lat: 44.0065, lng: -79.4504 },
  "ON:king": { lat: 44.0461, lng: -79.5283 },
  "ON:niagara-on-the-lake": { lat: 43.2554, lng: -79.0716 },
  "ON:sault-ste-marie": { lat: 46.5219, lng: -84.3461 },
  "ON:thorold": { lat: 43.1176, lng: -79.1990 },
  "ON:sarnia": { lat: 42.9745, lng: -82.4066 },
  "ON:welland": { lat: 42.9923, lng: -79.2485 },
  "ON:tecumseh": { lat: 42.2437, lng: -82.9279 },
  "ON:brant": { lat: 43.1167, lng: -80.3497 },
  "ON:east-gwillimbury": { lat: 44.1308, lng: -79.4174 },
  "ON:innisfil": { lat: 44.3006, lng: -79.5833 },
  "ON:whitchurch-stouffville": { lat: 43.9702, lng: -79.2443 },
  "ON:chatham-kent": { lat: 42.4048, lng: -82.1910 },
  "ON:courtice": { lat: 43.8684, lng: -78.8062 },
  "ON:bradford-west-gwillimbury": { lat: 44.1145, lng: -79.5630 },
  "ON:gananoque": { lat: 44.3291, lng: -76.1641 },
  "ON:belleville": { lat: 44.1628, lng: -77.3832 },
  "ON:stratford": { lat: 43.3700, lng: -80.9823 },
  "ON:lasalle": { lat: 42.2170, lng: -83.0646 },
  "ON:woodbridge": { lat: 43.7758, lng: -79.5932 },
  "ON:chatham": { lat: 42.4048, lng: -82.1910 },
  "ON:bowmanville": { lat: 43.9126, lng: -78.6882 },
  "ON:clarington": { lat: 43.9350, lng: -78.6083 },
  "ON:halton-hills": { lat: 43.6310, lng: -79.9503 },
  "ON:pelham": { lat: 43.0313, lng: -79.3316 },
  "ON:ennismore": { lat: 44.3764, lng: -78.4463 },
  "ON:cornwall": { lat: 45.0218, lng: -74.7280 },
  "ON:the-blue-mountains": { lat: 44.4915, lng: -80.4360 },

  // Alberta
  "AB:calgary": { lat: 51.0447, lng: -114.0719 },
  "AB:edmonton": { lat: 53.5461, lng: -113.4938 },
  "AB:red-deer": { lat: 52.2681, lng: -113.8112 },
  "AB:grande-prairie": { lat: 55.1707, lng: -118.7946 },
  "AB:lethbridge": { lat: 49.6936, lng: -112.8451 },
  "AB:medicine-hat": { lat: 50.0405, lng: -110.6764 },
  "AB:st-albert": { lat: 53.6301, lng: -113.6258 },

  // Quebec
  "QC:longueuil": { lat: 45.5312, lng: -73.5185 },
  "QC:laval": { lat: 45.6066, lng: -73.7124 },
  "QC:quebec-city": { lat: 46.8139, lng: -71.2080 },
  "QC:montreal": { lat: 45.5017, lng: -73.5673 },
  "QC:gatineau": { lat: 45.4765, lng: -75.7013 },
  "QC:sherbrooke": { lat: 45.4042, lng: -71.8929 },
  "QC:trois-rivieres": { lat: 46.3432, lng: -72.5418 },

  // British Columbia
  "BC:burnaby": { lat: 49.2488, lng: -122.9805 },
  "BC:surrey": { lat: 49.1913, lng: -122.8490 },
  "BC:victoria": { lat: 48.4284, lng: -123.3656 },
  "BC:vancouver": { lat: 49.2827, lng: -123.1207 },
  "BC:abbotsford": { lat: 49.0504, lng: -122.3045 },
  "BC:kelowna": { lat: 49.8880, lng: -119.4960 },
  "BC:nanaimo": { lat: 49.1659, lng: -123.9401 },
  "BC:kamloops": { lat: 50.6745, lng: -120.3273 },
  "BC:richmond": { lat: 49.1666, lng: -123.1336 },
  "BC:coquitlam": { lat: 49.2838, lng: -122.7932 },

  // Manitoba
  "MB:winnipeg": { lat: 49.8951, lng: -97.1384 },
  "MB:brandon": { lat: 49.8418, lng: -99.9530 },

  // Saskatchewan
  "SK:regina": { lat: 50.4452, lng: -104.6189 },
  "SK:saskatoon": { lat: 52.1332, lng: -106.6700 },

  // Nova Scotia
  "NS:dartmouth": { lat: 44.6713, lng: -63.5772 },
  "NS:halifax": { lat: 44.6488, lng: -63.5752 },
  "NS:sydney": { lat: 46.1368, lng: -60.1942 },

  // New Brunswick
  "NB:moncton": { lat: 46.0878, lng: -64.7782 },
  "NB:fredericton": { lat: 45.9636, lng: -66.6431 },
  "NB:saint-john": { lat: 45.2733, lng: -66.0633 },

  // Newfoundland and Labrador
  "NL:mount-pearl": { lat: 47.5189, lng: -52.8058 },
  "NL:st-johns": { lat: 47.5615, lng: -52.7126 },

  // Prince Edward Island
  "PE:charlottetown": { lat: 46.2382, lng: -63.1311 },
  "PE:summerside": { lat: 46.3934, lng: -63.7902 },

  // ─── UNITED STATES ────────────────────────────────────────────────────────────

  // Texas
  "TX:houston": { lat: 29.7604, lng: -95.3698 },
  "TX:san-antonio": { lat: 29.4241, lng: -98.4936 },
  "TX:fort-worth": { lat: 32.7555, lng: -97.3308 },
  "TX:el-paso": { lat: 31.7619, lng: -106.4850 },
  "TX:austin": { lat: 30.2672, lng: -97.7431 },
  "TX:dallas": { lat: 32.7767, lng: -96.7970 },
  "TX:arlington": { lat: 32.7357, lng: -97.1081 },
  "TX:plano": { lat: 33.0198, lng: -96.6989 },
  "TX:corpus-christi": { lat: 27.8006, lng: -97.3964 },
  "TX:lubbock": { lat: 33.5779, lng: -101.8552 },
  "TX:grand-prairie": { lat: 32.7460, lng: -96.9978 },
  "TX:richardson": { lat: 32.9483, lng: -96.7299 },
  "TX:allen": { lat: 33.1032, lng: -96.6706 },

  // Illinois
  "IL:chicago": { lat: 41.8781, lng: -87.6298 },
  "IL:rockford": { lat: 42.2711, lng: -89.0940 },
  "IL:joliet": { lat: 41.5250, lng: -88.0817 },
  "IL:naperville": { lat: 41.7508, lng: -88.1535 },
  "IL:aurora": { lat: 41.7606, lng: -88.3201 },
  "IL:plainfield": { lat: 41.6270, lng: -88.2037 },
  "IL:loves-park": { lat: 42.3200, lng: -89.0582 },
  "IL:oswego": { lat: 41.6836, lng: -88.3515 },
  "IL:machesney-park": { lat: 42.3472, lng: -89.0390 },
  "IL:new-lenox": { lat: 41.5120, lng: -87.9656 },

  // Florida
  "FL:jacksonville": { lat: 30.3322, lng: -81.6557 },
  "FL:tampa": { lat: 27.9506, lng: -82.4572 },
  "FL:orlando": { lat: 28.5383, lng: -81.3792 },
  "FL:fort-lauderdale": { lat: 26.1224, lng: -80.1373 },
  "FL:tallahassee": { lat: 30.4383, lng: -84.2807 },
  "FL:miami": { lat: 25.7617, lng: -80.1918 },
  "FL:cape-coral": { lat: 26.5629, lng: -81.9495 },
  "FL:hialeah": { lat: 25.8576, lng: -80.2781 },
  "FL:st-petersburg": { lat: 27.7676, lng: -82.6403 },
  "FL:port-st-lucie": { lat: 27.2730, lng: -80.3582 },
  "FL:fort-myers": { lat: 26.6406, lng: -81.8723 },
  "FL:oakland-park": { lat: 26.1723, lng: -80.1320 },
  "FL:largo": { lat: 27.9095, lng: -82.7873 },
  "FL:hialeah-gardens": { lat: 25.8648, lng: -80.3240 },
  "FL:clearwater": { lat: 27.9659, lng: -82.8001 },
  "FL:pompano-beach": { lat: 26.2379, lng: -80.1248 },
  "FL:pinellas-park": { lat: 27.8428, lng: -82.6993 },
  "FL:doral": { lat: 25.8195, lng: -80.3553 },

  // Tennessee
  "TN:memphis": { lat: 35.1495, lng: -90.0490 },
  "TN:nashville": { lat: 36.1627, lng: -86.7816 },
  "TN:knoxville": { lat: 35.9606, lng: -83.9207 },
  "TN:chattanooga": { lat: 35.0456, lng: -85.3097 },
  "TN:murfreesboro": { lat: 35.8456, lng: -86.3903 },
  "TN:clarksville": { lat: 36.5298, lng: -87.3595 },

  // Virginia
  "VA:richmond": { lat: 37.5407, lng: -77.4360 },
  "VA:chesapeake": { lat: 36.7682, lng: -76.2875 },
  "VA:arlington": { lat: 38.8799, lng: -77.1068 },
  "VA:virginia-beach": { lat: 36.8529, lng: -75.9780 },
  "VA:norfolk": { lat: 36.8508, lng: -76.2859 },
  "VA:falls-church": { lat: 38.8823, lng: -77.1711 },
  "VA:midlothian": { lat: 37.5021, lng: -77.6486 },
  "VA:alexandria": { lat: 38.8048, lng: -77.0469 },

  // Georgia
  "GA:atlanta": { lat: 33.7490, lng: -84.3880 },
  "GA:columbus": { lat: 32.4610, lng: -84.9877 },
  "GA:savannah": { lat: 32.0809, lng: -81.0912 },
  "GA:augusta": { lat: 33.4735, lng: -81.9748 },
  "GA:macon": { lat: 32.8407, lng: -83.6324 },
  "GA:martinez": { lat: 33.5174, lng: -82.0757 },
  "GA:marietta": { lat: 33.9526, lng: -84.5499 },
  "GA:norcross": { lat: 33.9412, lng: -84.2135 },
  "GA:evans": { lat: 33.5335, lng: -82.1307 },

  // Wisconsin
  "WI:madison": { lat: 43.0731, lng: -89.4012 },
  "WI:milwaukee": { lat: 43.0389, lng: -87.9065 },
  "WI:green-bay": { lat: 44.5133, lng: -88.0133 },
  "WI:racine": { lat: 42.7261, lng: -87.7829 },
  "WI:kenosha": { lat: 42.5847, lng: -87.8212 },
  "WI:west-allis": { lat: 43.0167, lng: -88.0070 },
  "WI:de-pere": { lat: 44.4489, lng: -88.0604 },
  "WI:sturtevant": { lat: 42.6978, lng: -87.8945 },
  "WI:superior": { lat: 46.7208, lng: -92.1041 },
  "WI:appleton": { lat: 44.2619, lng: -88.4154 },
  "WI:new-berlin": { lat: 42.9764, lng: -88.1084 },
  "WI:wauwatosa": { lat: 43.0495, lng: -88.0076 },

  // Arizona
  "AZ:phoenix": { lat: 33.4484, lng: -111.9430 },
  "AZ:tucson": { lat: 32.2226, lng: -110.9747 },
  "AZ:scottsdale": { lat: 33.4942, lng: -111.9261 },
  "AZ:mesa": { lat: 33.4152, lng: -111.8315 },
  "AZ:chandler": { lat: 33.3062, lng: -111.8413 },

  // North Carolina
  "NC:charlotte": { lat: 35.2271, lng: -80.8431 },
  "NC:raleigh": { lat: 35.7796, lng: -78.6382 },
  "NC:greensboro": { lat: 36.0726, lng: -79.7920 },
  "NC:winston-salem": { lat: 36.0999, lng: -80.2442 },
  "NC:durham": { lat: 35.9940, lng: -78.8986 },
  "NC:fayetteville": { lat: 35.0527, lng: -78.8784 },

  // Minnesota
  "MN:bloomington": { lat: 44.8408, lng: -93.2983 },
  "MN:minneapolis": { lat: 44.9778, lng: -93.2650 },
  "MN:rochester": { lat: 44.0121, lng: -92.4802 },
  "MN:st-paul": { lat: 44.9537, lng: -93.0900 },
  "MN:saint-paul": { lat: 44.9537, lng: -93.0900 },
  "MN:duluth": { lat: 46.7867, lng: -92.1005 },
  "MN:burnsville": { lat: 44.7677, lng: -93.2777 },

  // Michigan
  "MI:lansing": { lat: 42.7325, lng: -84.5555 },
  "MI:grand-rapids": { lat: 42.9634, lng: -85.6681 },
  "MI:detroit": { lat: 42.3314, lng: -83.0458 },
  "MI:sterling-heights": { lat: 42.5803, lng: -83.0302 },
  "MI:warren": { lat: 42.5145, lng: -83.0147 },
  "MI:troy": { lat: 42.6064, lng: -83.1498 },
  "MI:kentwood": { lat: 42.8695, lng: -85.6447 },
  "MI:livonia": { lat: 42.3684, lng: -83.3527 },

  // South Carolina
  "SC:charleston": { lat: 32.7765, lng: -79.9311 },
  "SC:greenville": { lat: 34.8526, lng: -82.3940 },
  "SC:columbia": { lat: 34.0007, lng: -81.0348 },
  "SC:myrtle-beach": { lat: 33.6891, lng: -78.8867 },
  "SC:rock-hill": { lat: 34.9249, lng: -81.0251 },

  // Alabama
  "AL:birmingham": { lat: 33.5186, lng: -86.8104 },
  "AL:huntsville": { lat: 34.7304, lng: -86.5861 },
  "AL:montgomery": { lat: 32.3668, lng: -86.3000 },
  "AL:mobile": { lat: 30.6954, lng: -88.0399 },
  "AL:tuscaloosa": { lat: 33.2098, lng: -87.5692 },
  "AL:phenix-city": { lat: 32.4710, lng: -85.0007 },

  // Nevada
  "NV:las-vegas": { lat: 36.1699, lng: -115.1398 },
  "NV:reno": { lat: 39.5296, lng: -119.8138 },
  "NV:henderson": { lat: 36.0395, lng: -114.9817 },
  "NV:north-las-vegas": { lat: 36.1989, lng: -115.1175 },

  // Colorado
  "CO:aurora": { lat: 39.7294, lng: -104.8319 },
  "CO:denver": { lat: 39.7392, lng: -104.9903 },
  "CO:colorado-springs": { lat: 38.8339, lng: -104.8214 },
  "CO:lakewood": { lat: 39.7047, lng: -105.0814 },
  "CO:fort-collins": { lat: 40.5853, lng: -105.0844 },

  // Utah
  "UT:salt-lake-city": { lat: 40.7608, lng: -111.8910 },
  "UT:sandy": { lat: 40.5649, lng: -111.8590 },
  "UT:orem": { lat: 40.2969, lng: -111.6946 },
  "UT:west-jordan": { lat: 40.6097, lng: -111.9391 },

  // New York
  "NY:rochester": { lat: 43.1566, lng: -77.6088 },

  // Washington DC
  "DC:washington": { lat: 38.9072, lng: -77.0369 },
};
