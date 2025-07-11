// Comprehensive Pickup Locations Data for Delhi
// Including all Delhi Metro stations, Railway stations, and Airport terminals

export const PICKUP_LOCATIONS = {
  metro: {
    // Red Line (29 stations)
    red: [
      { id: 'M-R-001', name: 'Rithala', lat: 28.7206, lng: 77.1011, address: 'Rithala, Sector 5, Rohini, Delhi' },
      { id: 'M-R-002', name: 'Rohini West', lat: 28.7147, lng: 77.1097, address: 'Rohini West, Delhi' },
      { id: 'M-R-003', name: 'Rohini East', lat: 28.7077, lng: 77.1067, address: 'Rohini East, Delhi' },
      { id: 'M-R-004', name: 'Pitampura', lat: 28.7026, lng: 77.1386, address: 'Pitampura, Delhi' },
      { id: 'M-R-005', name: 'Kohat Enclave', lat: 28.6978, lng: 77.1419, address: 'Kohat Enclave, Pitampura, Delhi' },
      { id: 'M-R-006', name: 'Netaji Subhash Place', lat: 28.6963, lng: 77.1524, address: 'Netaji Subhash Place, Pitampura, Delhi' },
      { id: 'M-R-007', name: 'Keshav Puram', lat: 28.6886, lng: 77.1615, address: 'Keshav Puram, Delhi' },
      { id: 'M-R-008', name: 'Kanhaiya Nagar', lat: 28.6826, lng: 77.1645, address: 'Kanhaiya Nagar, Delhi' },
      { id: 'M-R-009', name: 'Inderlok', lat: 28.6730, lng: 77.1703, address: 'Inderlok, Delhi' },
      { id: 'M-R-010', name: 'Shastri Nagar', lat: 28.6701, lng: 77.1817, address: 'Shastri Nagar, Delhi' },
      { id: 'M-R-011', name: 'Pratap Nagar', lat: 28.6666, lng: 77.1987, address: 'Pratap Nagar, Delhi' },
      { id: 'M-R-012', name: 'Pulbangash', lat: 28.6630, lng: 77.2032, address: 'Pulbangash, Delhi' },
      { id: 'M-R-013', name: 'Tis Hazari', lat: 28.6672, lng: 77.2165, address: 'Tis Hazari, Delhi' },
      { id: 'M-R-014', name: 'Kashmere Gate', lat: 28.6676, lng: 77.2281, address: 'Kashmere Gate, Delhi' },
      { id: 'M-R-015', name: 'Shastri Park', lat: 28.6680, lng: 77.2502, address: 'Shastri Park, Delhi' },
      { id: 'M-R-016', name: 'Seelampur', lat: 28.6697, lng: 77.2668, address: 'Seelampur, Delhi' },
      { id: 'M-R-017', name: 'Welcome', lat: 28.6718, lng: 77.2780, address: 'Welcome, Delhi' },
      { id: 'M-R-018', name: 'Shahdara', lat: 28.6734, lng: 77.2894, address: 'Shahdara, Delhi' },
      { id: 'M-R-019', name: 'Mansarovar Park', lat: 28.6755, lng: 77.3012, address: 'Mansarovar Park, Delhi' },
      { id: 'M-R-020', name: 'Jhilmil', lat: 28.6758, lng: 77.3125, address: 'Jhilmil, Delhi' },
      { id: 'M-R-021', name: 'Dilshad Garden', lat: 28.6752, lng: 77.3208, address: 'Dilshad Garden, Delhi' },
      { id: 'M-R-022', name: 'Shaheed Nagar', lat: 28.6827, lng: 77.3222, address: 'Shaheed Nagar, Ghaziabad' },
      { id: 'M-R-023', name: 'Raj Bagh', lat: 28.6890, lng: 77.3285, address: 'Raj Bagh, Ghaziabad' },
      { id: 'M-R-024', name: 'Major Mohit Sharma Rajendra Nagar', lat: 28.6969, lng: 77.3459, address: 'Rajendra Nagar, Ghaziabad' },
      { id: 'M-R-025', name: 'Shyam Park', lat: 28.7029, lng: 77.3705, address: 'Shyam Park, Ghaziabad' },
      { id: 'M-R-026', name: 'Mohan Nagar', lat: 28.6997, lng: 77.3901, address: 'Mohan Nagar, Ghaziabad' },
      { id: 'M-R-027', name: 'Arthala', lat: 28.6959, lng: 77.4135, address: 'Arthala, Ghaziabad' },
      { id: 'M-R-028', name: 'Hindon River', lat: 28.6926, lng: 77.4373, address: 'Hindon River, Ghaziabad' },
      { id: 'M-R-029', name: 'Shaheed Sthal (New Bus Adda)', lat: 28.6865, lng: 77.4509, address: 'New Bus Adda, Ghaziabad' }
    ],
    
    // Yellow Line (37 stations)
    yellow: [
      { id: 'M-Y-001', name: 'Samaypur Badli', lat: 28.7473, lng: 77.1377, address: 'Samaypur Badli, Delhi' },
      { id: 'M-Y-002', name: 'Rohini Sector-18,19', lat: 28.7390, lng: 77.1402, address: 'Rohini Sector 18-19, Delhi' },
      { id: 'M-Y-003', name: 'Haiderpur Badli Mor', lat: 28.7286, lng: 77.1518, address: 'Haiderpur Badli Mor, Delhi' },
      { id: 'M-Y-004', name: 'Jahangirpuri', lat: 28.7258, lng: 77.1625, address: 'Jahangirpuri, Delhi' },
      { id: 'M-Y-005', name: 'Adarsh Nagar', lat: 28.7163, lng: 77.1707, address: 'Adarsh Nagar, Delhi' },
      { id: 'M-Y-006', name: 'Azadpur', lat: 28.7066, lng: 77.1806, address: 'Azadpur, Delhi' },
      { id: 'M-Y-007', name: 'Model Town', lat: 28.7028, lng: 77.1938, address: 'Model Town, Delhi' },
      { id: 'M-Y-008', name: 'GTB Nagar', lat: 28.6978, lng: 77.2070, address: 'GTB Nagar, Delhi' },
      { id: 'M-Y-009', name: 'Vishwavidyalaya', lat: 28.6950, lng: 77.2146, address: 'Vishwavidyalaya, Delhi' },
      { id: 'M-Y-010', name: 'Vidhan Sabha', lat: 28.6881, lng: 77.2214, address: 'Vidhan Sabha, Civil Lines, Delhi' },
      { id: 'M-Y-011', name: 'Civil Lines', lat: 28.6773, lng: 77.2241, address: 'Civil Lines, Delhi' },
      { id: 'M-Y-012', name: 'Chandni Chowk', lat: 28.6580, lng: 77.2302, address: 'Chandni Chowk, Delhi' },
      { id: 'M-Y-013', name: 'Chawri Bazar', lat: 28.6489, lng: 77.2263, address: 'Chawri Bazar, Delhi' },
      { id: 'M-Y-014', name: 'New Delhi', lat: 28.6431, lng: 77.2211, address: 'New Delhi Railway Station, Delhi' },
      { id: 'M-Y-015', name: 'Rajiv Chowk', lat: 28.6328, lng: 77.2197, address: 'Connaught Place, Delhi' },
      { id: 'M-Y-016', name: 'Patel Chowk', lat: 28.6226, lng: 77.2141, address: 'Patel Chowk, Delhi' },
      { id: 'M-Y-017', name: 'Central Secretariat', lat: 28.6149, lng: 77.2125, address: 'Central Secretariat, Delhi' },
      { id: 'M-Y-018', name: 'Udyog Bhawan', lat: 28.6118, lng: 77.2106, address: 'Udyog Bhawan, Delhi' },
      { id: 'M-Y-019', name: 'Lok Kalyan Marg', lat: 28.5996, lng: 77.2109, address: 'Lok Kalyan Marg, Delhi' },
      { id: 'M-Y-020', name: 'Jor Bagh', lat: 28.5873, lng: 77.2124, address: 'Jor Bagh, Delhi' },
      { id: 'M-Y-021', name: 'INA', lat: 28.5752, lng: 77.2090, address: 'INA Market, Delhi' },
      { id: 'M-Y-022', name: 'AIIMS', lat: 28.5686, lng: 77.2080, address: 'AIIMS, Delhi' },
      { id: 'M-Y-023', name: 'Green Park', lat: 28.5599, lng: 77.2067, address: 'Green Park, Delhi' },
      { id: 'M-Y-024', name: 'Hauz Khas', lat: 28.5433, lng: 77.2066, address: 'Hauz Khas, Delhi' },
      { id: 'M-Y-025', name: 'Malviya Nagar', lat: 28.5281, lng: 77.2056, address: 'Malviya Nagar, Delhi' },
      { id: 'M-Y-026', name: 'Saket', lat: 28.5208, lng: 77.2015, address: 'Saket, Delhi' },
      { id: 'M-Y-027', name: 'Qutab Minar', lat: 28.5131, lng: 77.1857, address: 'Qutab Minar, Delhi' },
      { id: 'M-Y-028', name: 'Chhatarpur', lat: 28.5065, lng: 77.1748, address: 'Chhatarpur, Delhi' },
      { id: 'M-Y-029', name: 'Sultanpur', lat: 28.4992, lng: 77.1613, address: 'Sultanpur, Delhi' },
      { id: 'M-Y-030', name: 'Ghitorni', lat: 28.4938, lng: 77.1493, address: 'Ghitorni, Delhi' },
      { id: 'M-Y-031', name: 'Arjan Garh', lat: 28.4808, lng: 77.1257, address: 'Arjan Garh, Delhi' },
      { id: 'M-Y-032', name: 'Guru Dronacharya', lat: 28.4821, lng: 77.1025, address: 'Guru Dronacharya, Gurgaon' },
      { id: 'M-Y-033', name: 'Sikanderpur', lat: 28.4815, lng: 77.0921, address: 'Sikanderpur, Gurgaon' },
      { id: 'M-Y-034', name: 'MG Road', lat: 28.4799, lng: 77.0799, address: 'MG Road, Gurgaon' },
      { id: 'M-Y-035', name: 'IFFCO Chowk', lat: 28.4725, lng: 77.0720, address: 'IFFCO Chowk, Gurgaon' },
      { id: 'M-Y-036', name: 'Millennium City Centre', lat: 28.4595, lng: 77.0266, address: 'Millennium City Centre, Gurgaon' }
    ],
    
    // Blue Line (50 stations)
    blue: [
      { id: 'M-B-001', name: 'Dwarka Sector 21', lat: 28.5527, lng: 77.0585, address: 'Dwarka Sector 21, Delhi' },
      { id: 'M-B-002', name: 'Dwarka Sector 8', lat: 28.5655, lng: 77.0670, address: 'Dwarka Sector 8, Delhi' },
      { id: 'M-B-003', name: 'Dwarka Sector 9', lat: 28.5744, lng: 77.0649, address: 'Dwarka Sector 9, Delhi' },
      { id: 'M-B-004', name: 'Dwarka Sector 10', lat: 28.5870, lng: 77.0575, address: 'Dwarka Sector 10, Delhi' },
      { id: 'M-B-005', name: 'Dwarka Sector 11', lat: 28.5925, lng: 77.0497, address: 'Dwarka Sector 11, Delhi' },
      { id: 'M-B-006', name: 'Dwarka Sector 12', lat: 28.5924, lng: 77.0403, address: 'Dwarka Sector 12, Delhi' },
      { id: 'M-B-007', name: 'Dwarka Sector 13', lat: 28.5977, lng: 77.0292, address: 'Dwarka Sector 13, Delhi' },
      { id: 'M-B-008', name: 'Dwarka Sector 14', lat: 28.6052, lng: 77.0218, address: 'Dwarka Sector 14, Delhi' },
      { id: 'M-B-009', name: 'Dwarka', lat: 28.6157, lng: 77.0218, address: 'Dwarka, Delhi' },
      { id: 'M-B-010', name: 'Dwarka Mor', lat: 28.6192, lng: 77.0332, address: 'Dwarka Mor, Delhi' },
      { id: 'M-B-011', name: 'Nawada', lat: 28.6203, lng: 77.0452, address: 'Nawada, Delhi' },
      { id: 'M-B-012', name: 'Uttam Nagar West', lat: 28.6217, lng: 77.0559, address: 'Uttam Nagar West, Delhi' },
      { id: 'M-B-013', name: 'Uttam Nagar East', lat: 28.6248, lng: 77.0649, address: 'Uttam Nagar East, Delhi' },
      { id: 'M-B-014', name: 'Janakpuri West', lat: 28.6293, lng: 77.0878, address: 'Janakpuri West, Delhi' },
      { id: 'M-B-015', name: 'Janakpuri East', lat: 28.6329, lng: 77.0815, address: 'Janakpuri East, Delhi' },
      { id: 'M-B-016', name: 'Tilak Nagar', lat: 28.6386, lng: 77.0967, address: 'Tilak Nagar, Delhi' },
      { id: 'M-B-017', name: 'Subhash Nagar', lat: 28.6400, lng: 77.1044, address: 'Subhash Nagar, Delhi' },
      { id: 'M-B-018', name: 'Tagore Garden', lat: 28.6438, lng: 77.1129, address: 'Tagore Garden, Delhi' },
      { id: 'M-B-019', name: 'Rajouri Garden', lat: 28.6494, lng: 77.1227, address: 'Rajouri Garden, Delhi' },
      { id: 'M-B-020', name: 'Ramesh Nagar', lat: 28.6532, lng: 77.1316, address: 'Ramesh Nagar, Delhi' },
      { id: 'M-B-021', name: 'Moti Nagar', lat: 28.6576, lng: 77.1427, address: 'Moti Nagar, Delhi' },
      { id: 'M-B-022', name: 'Kirti Nagar', lat: 28.6556, lng: 77.1506, address: 'Kirti Nagar, Delhi' },
      { id: 'M-B-023', name: 'Shadipur', lat: 28.6515, lng: 77.1579, address: 'Shadipur, Delhi' },
      { id: 'M-B-024', name: 'Patel Nagar', lat: 28.6449, lng: 77.1693, address: 'Patel Nagar, Delhi' },
      { id: 'M-B-025', name: 'Rajendra Place', lat: 28.6424, lng: 77.1779, address: 'Rajendra Place, Delhi' },
      { id: 'M-B-026', name: 'Karol Bagh', lat: 28.6527, lng: 77.1902, address: 'Karol Bagh, Delhi' },
      { id: 'M-B-027', name: 'Jhandewalan', lat: 28.6438, lng: 77.2007, address: 'Jhandewalan, Delhi' },
      { id: 'M-B-028', name: 'Ramakrishna Ashram Marg', lat: 28.6392, lng: 77.2085, address: 'RK Ashram Marg, Delhi' },
      { id: 'M-B-029', name: 'Barakhamba Road', lat: 28.6296, lng: 77.2246, address: 'Barakhamba Road, Delhi' },
      { id: 'M-B-030', name: 'Mandi House', lat: 28.6258, lng: 77.2341, address: 'Mandi House, Delhi' },
      { id: 'M-B-031', name: 'Pragati Maidan', lat: 28.6232, lng: 77.2421, address: 'Pragati Maidan, Delhi' },
      { id: 'M-B-032', name: 'Indraprastha', lat: 28.6205, lng: 77.2463, address: 'Indraprastha, Delhi' },
      { id: 'M-B-033', name: 'Yamuna Bank', lat: 28.6148, lng: 77.3080, address: 'Yamuna Bank, Delhi' },
      { id: 'M-B-034', name: 'Laxmi Nagar', lat: 28.6306, lng: 77.2776, address: 'Laxmi Nagar, Delhi' },
      { id: 'M-B-035', name: 'Nirman Vihar', lat: 28.6368, lng: 77.2868, address: 'Nirman Vihar, Delhi' },
      { id: 'M-B-036', name: 'Preet Vihar', lat: 28.6418, lng: 77.2954, address: 'Preet Vihar, Delhi' },
      { id: 'M-B-037', name: 'Karkardooma', lat: 28.6484, lng: 77.3059, address: 'Karkardooma, Delhi' },
      { id: 'M-B-038', name: 'Anand Vihar ISBT', lat: 28.6469, lng: 77.3159, address: 'Anand Vihar ISBT, Delhi' },
      { id: 'M-B-039', name: 'Kaushambi', lat: 28.6455, lng: 77.3244, address: 'Kaushambi, Ghaziabad' },
      { id: 'M-B-040', name: 'Vaishali', lat: 28.6500, lng: 77.3397, address: 'Vaishali, Ghaziabad' },
      // Branch to Noida
      { id: 'M-B-041', name: 'Akshardham', lat: 28.6183, lng: 77.2792, address: 'Akshardham, Delhi' },
      { id: 'M-B-042', name: 'Mayur Vihar-I', lat: 28.6042, lng: 77.2893, address: 'Mayur Vihar Phase-1, Delhi' },
      { id: 'M-B-043', name: 'Mayur Vihar Extension', lat: 28.5945, lng: 77.2943, address: 'Mayur Vihar Extension, Delhi' },
      { id: 'M-B-044', name: 'New Ashok Nagar', lat: 28.5892, lng: 77.3018, address: 'New Ashok Nagar, Delhi' },
      { id: 'M-B-045', name: 'Noida Sector 15', lat: 28.5850, lng: 77.3113, address: 'Sector 15, Noida' },
      { id: 'M-B-046', name: 'Noida Sector 16', lat: 28.5783, lng: 77.3176, address: 'Sector 16, Noida' },
      { id: 'M-B-047', name: 'Noida Sector 18', lat: 28.5709, lng: 77.3261, address: 'Sector 18, Noida' },
      { id: 'M-B-048', name: 'Botanical Garden', lat: 28.5640, lng: 77.3342, address: 'Botanical Garden, Noida' },
      { id: 'M-B-049', name: 'Golf Course', lat: 28.5673, lng: 77.3460, address: 'Golf Course, Noida' },
      { id: 'M-B-050', name: 'Noida City Centre', lat: 28.5746, lng: 77.3560, address: 'Sector 32, Noida' }
    ],
    
    // Green Line (24 stations including branch)
    green: [
      // Main Line
      { id: 'M-G-001', name: 'Brigadier Hoshiar Singh', lat: 28.6977, lng: 77.0734, address: 'Bahadurgarh, Haryana' },
      { id: 'M-G-002', name: 'Bahadurgarh City', lat: 28.6891, lng: 77.0927, address: 'Bahadurgarh City, Haryana' },
      { id: 'M-G-003', name: 'Pandit Shree Ram Sharma', lat: 28.6806, lng: 77.1120, address: 'Tikri Border, Delhi' },
      { id: 'M-G-004', name: 'Tikri Border', lat: 28.6727, lng: 77.1308, address: 'Tikri Border, Delhi' },
      { id: 'M-G-005', name: 'Tikri Kalan', lat: 28.6722, lng: 77.1409, address: 'Tikri Kalan, Delhi' },
      { id: 'M-G-006', name: 'Ghevra Metro Station', lat: 28.6721, lng: 77.1486, address: 'Ghevra, Delhi' },
      { id: 'M-G-007', name: 'Mundka Industrial Area', lat: 28.6802, lng: 77.0318, address: 'Mundka Industrial Area, Delhi' },
      { id: 'M-G-008', name: 'Mundka', lat: 28.6823, lng: 77.0305, address: 'Mundka, Delhi' },
      { id: 'M-G-009', name: 'Rajdhani Park', lat: 28.6758, lng: 77.0482, address: 'Rajdhani Park, Delhi' },
      { id: 'M-G-010', name: 'Nangloi Railway Station', lat: 28.6748, lng: 77.0572, address: 'Nangloi, Delhi' },
      { id: 'M-G-011', name: 'Nangloi', lat: 28.6724, lng: 77.0668, address: 'Nangloi, Delhi' },
      { id: 'M-G-012', name: 'Maharaja Surajmal Stadium', lat: 28.6716, lng: 77.0765, address: 'Nangloi, Delhi' },
      { id: 'M-G-013', name: 'Udyog Nagar', lat: 28.6716, lng: 77.0863, address: 'Udyog Nagar, Delhi' },
      { id: 'M-G-014', name: 'Peeragarhi', lat: 28.6716, lng: 77.0961, address: 'Peeragarhi, Delhi' },
      { id: 'M-G-015', name: 'Paschim Vihar West', lat: 28.6716, lng: 77.1059, address: 'Paschim Vihar West, Delhi' },
      { id: 'M-G-016', name: 'Paschim Vihar East', lat: 28.6716, lng: 77.1157, address: 'Paschim Vihar East, Delhi' },
      { id: 'M-G-017', name: 'Madipur', lat: 28.6716, lng: 77.1255, address: 'Madipur, Delhi' },
      { id: 'M-G-018', name: 'Shivaji Park', lat: 28.6745, lng: 77.1331, address: 'Shivaji Park, Delhi' },
      { id: 'M-G-019', name: 'Punjabi Bagh', lat: 28.6738, lng: 77.1464, address: 'Punjabi Bagh, Delhi' },
      { id: 'M-G-020', name: 'Ashok Park Main', lat: 28.6717, lng: 77.1555, address: 'Ashok Park, Delhi' },
      { id: 'M-G-021', name: 'Satguru Ram Singh Marg', lat: 28.6611, lng: 77.1514, address: 'Kirti Nagar, Delhi' },
      // Branch to Indraprastha
      { id: 'M-G-022', name: 'Punjabi Bagh West', lat: 28.6677, lng: 77.1309, address: 'Punjabi Bagh West, Delhi' },
      { id: 'M-G-023', name: 'Shakurpur', lat: 28.6621, lng: 77.1381, address: 'Shakurpur, Delhi' },
      { id: 'M-G-024', name: 'Mayapuri', lat: 28.6371, lng: 77.1295, address: 'Mayapuri, Delhi' }
    ],
    
    // Violet Line (34 stations)
    violet: [
      { id: 'M-V-001', name: 'Kashmere Gate', lat: 28.6676, lng: 77.2281, address: 'Kashmere Gate, Delhi' },
      { id: 'M-V-002', name: 'Lal Quila', lat: 28.6560, lng: 77.2410, address: 'Red Fort, Delhi' },
      { id: 'M-V-003', name: 'Jama Masjid', lat: 28.6508, lng: 77.2340, address: 'Jama Masjid, Delhi' },
      { id: 'M-V-004', name: 'Delhi Gate', lat: 28.6405, lng: 77.2412, address: 'Delhi Gate, Delhi' },
      { id: 'M-V-005', name: 'ITO', lat: 28.6308, lng: 77.2410, address: 'ITO, Delhi' },
      { id: 'M-V-006', name: 'Janpath', lat: 28.6251, lng: 77.2192, address: 'Janpath, Delhi' },
      { id: 'M-V-007', name: 'Khan Market', lat: 28.6003, lng: 77.2269, address: 'Khan Market, Delhi' },
      { id: 'M-V-008', name: 'JLN Stadium', lat: 28.5905, lng: 77.2337, address: 'JLN Stadium, Delhi' },
      { id: 'M-V-009', name: 'Jangpura', lat: 28.5846, lng: 77.2377, address: 'Jangpura, Delhi' },
      { id: 'M-V-010', name: 'Lajpat Nagar', lat: 28.5708, lng: 77.2365, address: 'Lajpat Nagar, Delhi' },
      { id: 'M-V-011', name: 'Moolchand', lat: 28.5644, lng: 77.2342, address: 'Moolchand, Delhi' },
      { id: 'M-V-012', name: 'Kailash Colony', lat: 28.5552, lng: 77.2420, address: 'Kailash Colony, Delhi' },
      { id: 'M-V-013', name: 'Nehru Place', lat: 28.5519, lng: 77.2519, address: 'Nehru Place, Delhi' },
      { id: 'M-V-014', name: 'Kalkaji Mandir', lat: 28.5504, lng: 77.2585, address: 'Kalkaji Mandir, Delhi' },
      { id: 'M-V-015', name: 'Govindpuri', lat: 28.5443, lng: 77.2644, address: 'Govindpuri, Delhi' },
      { id: 'M-V-016', name: 'Okhla', lat: 28.5346, lng: 77.2749, address: 'Okhla, Delhi' },
      { id: 'M-V-017', name: 'Jasola Apollo', lat: 28.5380, lng: 77.2834, address: 'Jasola Apollo, Delhi' },
      { id: 'M-V-018', name: 'Sarita Vihar', lat: 28.5318, lng: 77.2885, address: 'Sarita Vihar, Delhi' },
      { id: 'M-V-019', name: 'Mohan Estate', lat: 28.5247, lng: 77.2940, address: 'Mohan Estate, Delhi' },
      { id: 'M-V-020', name: 'Tughlakabad', lat: 28.5018, lng: 77.2985, address: 'Tughlakabad, Delhi' },
      { id: 'M-V-021', name: 'Badarpur Border', lat: 28.4933, lng: 77.3031, address: 'Badarpur Border, Delhi' },
      { id: 'M-V-022', name: 'Sarai', lat: 28.4814, lng: 77.3067, address: 'Sarai, Faridabad' },
      { id: 'M-V-023', name: 'NHPC Chowk', lat: 28.4736, lng: 77.3089, address: 'NHPC Chowk, Faridabad' },
      { id: 'M-V-024', name: 'Mewala Maharajpur', lat: 28.4659, lng: 77.3111, address: 'Mewala Maharajpur, Faridabad' },
      { id: 'M-V-025', name: 'Sector 28', lat: 28.4582, lng: 77.3133, address: 'Sector 28, Faridabad' },
      { id: 'M-V-026', name: 'Badkal Mor', lat: 28.4436, lng: 77.3152, address: 'Badkal Mor, Faridabad' },
      { id: 'M-V-027', name: 'Old Faridabad', lat: 28.4217, lng: 77.3174, address: 'Old Faridabad' },
      { id: 'M-V-028', name: 'Neelam Chowk Ajronda', lat: 28.4132, lng: 77.3098, address: 'Neelam Chowk, Faridabad' },
      { id: 'M-V-029', name: 'Bata Chowk', lat: 28.4082, lng: 77.3178, address: 'Bata Chowk, Faridabad' },
      { id: 'M-V-030', name: 'Escorts Mujesar', lat: 28.3960, lng: 77.2935, address: 'Escorts Mujesar, Faridabad' },
      { id: 'M-V-031', name: 'Sant Surdas (Sihi)', lat: 28.3907, lng: 77.2871, address: 'Sant Surdas, Faridabad' },
      { id: 'M-V-032', name: 'Raja Nahar Singh (Ballabhgarh)', lat: 28.3845, lng: 77.2802, address: 'Ballabhgarh, Faridabad' }
    ],
    
    // Pink Line (38 stations)
    pink: [
      { id: 'M-P-001', name: 'Majlis Park', lat: 28.7241, lng: 77.1307, address: 'Majlis Park, Delhi' },
      { id: 'M-P-002', name: 'Shalimar Bagh', lat: 28.7175, lng: 77.1527, address: 'Shalimar Bagh, Delhi' },
      { id: 'M-P-003', name: 'Shakurpur', lat: 28.7171, lng: 77.1639, address: 'Shakurpur, Delhi' },
      { id: 'M-P-004', name: 'Punjabi Bagh West', lat: 28.6677, lng: 77.1309, address: 'Punjabi Bagh West, Delhi' },
      { id: 'M-P-005', name: 'ESI-Basaidarapur', lat: 28.6731, lng: 77.0839, address: 'ESI Hospital, Delhi' },
      { id: 'M-P-006', name: 'Rajouri Garden', lat: 28.6494, lng: 77.1227, address: 'Rajouri Garden, Delhi' },
      { id: 'M-P-007', name: 'Maya Enclave', lat: 28.6342, lng: 77.1296, address: 'Maya Enclave, Delhi' },
      { id: 'M-P-008', name: 'Naraina Vihar', lat: 28.6276, lng: 77.1393, address: 'Naraina Vihar, Delhi' },
      { id: 'M-P-009', name: 'Delhi Cantt', lat: 28.6217, lng: 77.1563, address: 'Delhi Cantt, Delhi' },
      { id: 'M-P-010', name: 'Durgabai Deshmukh South Campus', lat: 28.5440, lng: 77.2167, address: 'South Campus, Delhi' },
      { id: 'M-P-011', name: 'Sir M. Visvesvaraya Moti Bagh', lat: 28.5750, lng: 77.1846, address: 'Moti Bagh, Delhi' },
      { id: 'M-P-012', name: 'Bhikaji Cama Place', lat: 28.5686, lng: 77.1906, address: 'Bhikaji Cama Place, Delhi' },
      { id: 'M-P-013', name: 'Sarojini Nagar', lat: 28.5760, lng: 77.1989, address: 'Sarojini Nagar, Delhi' },
      { id: 'M-P-014', name: 'INA', lat: 28.5752, lng: 77.2090, address: 'INA Market, Delhi' },
      { id: 'M-P-015', name: 'South Extension', lat: 28.5619, lng: 77.2198, address: 'South Extension, Delhi' },
      { id: 'M-P-016', name: 'Vinobapuri', lat: 28.5662, lng: 77.2411, address: 'Vinobapuri, Delhi' },
      { id: 'M-P-017', name: 'Ashram', lat: 28.5719, lng: 77.2585, address: 'Ashram, Delhi' },
      { id: 'M-P-018', name: 'Sarai Kale Khan Nizamuddin', lat: 28.5916, lng: 77.2542, address: 'Nizamuddin, Delhi' },
      { id: 'M-P-019', name: 'Mayur Vihar Pocket-1', lat: 28.6042, lng: 77.2893, address: 'Mayur Vihar Phase-1, Delhi' },
      { id: 'M-P-020', name: 'Trilokpuri Sanjay Lake', lat: 28.6010, lng: 77.3046, address: 'Trilokpuri, Delhi' },
      { id: 'M-P-021', name: 'East Vinod Nagar Mayur Vihar-II', lat: 28.6222, lng: 77.3013, address: 'Vinod Nagar, Delhi' },
      { id: 'M-P-022', name: 'Mandawali West Fazalpur', lat: 28.6293, lng: 77.3014, address: 'Mandawali, Delhi' },
      { id: 'M-P-023', name: 'IP Extension', lat: 28.6359, lng: 77.3008, address: 'IP Extension, Delhi' },
      { id: 'M-P-024', name: 'Anand Vihar ISBT', lat: 28.6469, lng: 77.3159, address: 'Anand Vihar ISBT, Delhi' },
      { id: 'M-P-025', name: 'Karkardooma', lat: 28.6484, lng: 77.3059, address: 'Karkardooma, Delhi' },
      { id: 'M-P-026', name: 'Karkardooma Court', lat: 28.6527, lng: 77.3061, address: 'Karkardooma Court, Delhi' },
      { id: 'M-P-027', name: 'Krishna Nagar', lat: 28.6617, lng: 77.2968, address: 'Krishna Nagar, Delhi' },
      { id: 'M-P-028', name: 'East Azad Nagar', lat: 28.6646, lng: 77.2875, address: 'East Azad Nagar, Delhi' },
      { id: 'M-P-029', name: 'Welcome', lat: 28.6718, lng: 77.2780, address: 'Welcome, Delhi' },
      { id: 'M-P-030', name: 'Jafrabad', lat: 28.6825, lng: 77.2797, address: 'Jafrabad, Delhi' },
      { id: 'M-P-031', name: 'Maujpur-Babarpur', lat: 28.6902, lng: 77.2795, address: 'Maujpur, Delhi' },
      { id: 'M-P-032', name: 'Gokulpuri', lat: 28.7026, lng: 77.2838, address: 'Gokulpuri, Delhi' },
      { id: 'M-P-033', name: 'Johri Enclave', lat: 28.7103, lng: 77.2824, address: 'Johri Enclave, Delhi' },
      { id: 'M-P-034', name: 'Shiv Vihar', lat: 28.7177, lng: 77.2965, address: 'Shiv Vihar, Delhi' }
    ],
    
    // Magenta Line (26 stations)
    magenta: [
      { id: 'M-M-001', name: 'Janakpuri West', lat: 28.6293, lng: 77.0878, address: 'Janakpuri West, Delhi' },
      { id: 'M-M-002', name: 'Dabri Mor-Janakpuri South', lat: 28.6122, lng: 77.0807, address: 'Dabri Mor, Delhi' },
      { id: 'M-M-003', name: 'Dashrath Puri', lat: 28.6004, lng: 77.0814, address: 'Dashrath Puri, Delhi' },
      { id: 'M-M-004', name: 'Palam', lat: 28.5891, lng: 77.0843, address: 'Palam, Delhi' },
      { id: 'M-M-005', name: 'Sadar Bazaar Cantonment', lat: 28.5811, lng: 77.0932, address: 'Sadar Bazaar, Delhi Cantt' },
      { id: 'M-M-006', name: 'Terminal 1-IGI Airport', lat: 28.5562, lng: 77.0870, address: 'Terminal 1, IGI Airport, Delhi' },
      { id: 'M-M-007', name: 'Shankar Vihar', lat: 28.5789, lng: 77.1305, address: 'Shankar Vihar, Delhi' },
      { id: 'M-M-008', name: 'Vasant Vihar', lat: 28.5569, lng: 77.1589, address: 'Vasant Vihar, Delhi' },
      { id: 'M-M-009', name: 'Munirka', lat: 28.5580, lng: 77.1741, address: 'Munirka, Delhi' },
      { id: 'M-M-010', name: 'R.K. Puram', lat: 28.5622, lng: 77.1862, address: 'R.K. Puram, Delhi' },
      { id: 'M-M-011', name: 'IIT Delhi', lat: 28.5475, lng: 77.1925, address: 'IIT Delhi, Delhi' },
      { id: 'M-M-012', name: 'Hauz Khas', lat: 28.5433, lng: 77.2066, address: 'Hauz Khas, Delhi' },
      { id: 'M-M-013', name: 'Panchsheel Park', lat: 28.5410, lng: 77.2173, address: 'Panchsheel Park, Delhi' },
      { id: 'M-M-014', name: 'Chirag Delhi', lat: 28.5378, lng: 77.2279, address: 'Chirag Delhi, Delhi' },
      { id: 'M-M-015', name: 'Greater Kailash', lat: 28.5342, lng: 77.2392, address: 'Greater Kailash, Delhi' },
      { id: 'M-M-016', name: 'Nehru Enclave', lat: 28.5518, lng: 77.2507, address: 'Nehru Enclave, Delhi' },
      { id: 'M-M-017', name: 'Okhla NSIC', lat: 28.5530, lng: 77.2682, address: 'Okhla NSIC, Delhi' },
      { id: 'M-M-018', name: 'Sukhdev Vihar', lat: 28.5521, lng: 77.2777, address: 'Sukhdev Vihar, Delhi' },
      { id: 'M-M-019', name: 'Jamia Millia Islamia', lat: 28.5617, lng: 77.2808, address: 'Jamia Millia Islamia, Delhi' },
      { id: 'M-M-020', name: 'Okhla Vihar', lat: 28.5682, lng: 77.2880, address: 'Okhla Vihar, Delhi' },
      { id: 'M-M-021', name: 'Jasola Vihar Shaheen Bagh', lat: 28.5381, lng: 77.2893, address: 'Shaheen Bagh, Delhi' },
      { id: 'M-M-022', name: 'Kalindi Kunj', lat: 28.5509, lng: 77.3100, address: 'Kalindi Kunj, Delhi' },
      { id: 'M-M-023', name: 'Okhla Bird Sanctuary', lat: 28.5493, lng: 77.3164, address: 'Okhla Bird Sanctuary, Delhi' },
      { id: 'M-M-024', name: 'Botanical Garden', lat: 28.5640, lng: 77.3342, address: 'Botanical Garden, Noida' }
    ],
    
    // Orange Line/Airport Express (6 stations)
    orange: [
      { id: 'M-O-001', name: 'New Delhi', lat: 28.6431, lng: 77.2211, address: 'New Delhi Railway Station, Delhi' },
      { id: 'M-O-002', name: 'Shivaji Stadium', lat: 28.6290, lng: 77.2116, address: 'Shivaji Stadium, Delhi' },
      { id: 'M-O-003', name: 'Dhaula Kuan', lat: 28.5918, lng: 77.1609, address: 'Dhaula Kuan, Delhi' },
      { id: 'M-O-004', name: 'Delhi Aerocity', lat: 28.5487, lng: 77.1183, address: 'Aerocity, Delhi' },
      { id: 'M-O-005', name: 'IGI Airport (T3)', lat: 28.5562, lng: 77.0870, address: 'Terminal 3, IGI Airport, Delhi' },
      { id: 'M-O-006', name: 'Yashobhoomi Dwarka Sector 25', lat: 28.5620, lng: 77.0467, address: 'Dwarka Sector 25, Delhi' }
    ],
    
    // Grey Line (3 stations)
    grey: [
      { id: 'M-GR-001', name: 'Dwarka', lat: 28.6157, lng: 77.0218, address: 'Dwarka, Delhi' },
      { id: 'M-GR-002', name: 'Dhansa Bus Stand', lat: 28.6150, lng: 76.9650, address: 'Dhansa Bus Stand, Delhi' },
      { id: 'M-GR-003', name: 'Najafgarh', lat: 28.6098, lng: 76.9797, address: 'Najafgarh, Delhi' }
    ],
    
    // Aqua Line (21 stations) - Noida/Greater Noida
    aqua: [
      { id: 'M-A-001', name: 'Noida Sector 51', lat: 28.5859, lng: 77.3713, address: 'Sector 51, Noida' },
      { id: 'M-A-002', name: 'Noida Sector 50', lat: 28.5774, lng: 77.3693, address: 'Sector 50, Noida' },
      { id: 'M-A-003', name: 'Noida Sector 76', lat: 28.5717, lng: 77.3677, address: 'Sector 76, Noida' },
      { id: 'M-A-004', name: 'Noida Sector 101', lat: 28.5649, lng: 77.3731, address: 'Sector 101, Noida' },
      { id: 'M-A-005', name: 'Noida Sector 81', lat: 28.5594, lng: 77.3748, address: 'Sector 81, Noida' },
      { id: 'M-A-006', name: 'NSEZ', lat: 28.5537, lng: 77.3792, address: 'NSEZ, Noida' },
      { id: 'M-A-007', name: 'Noida Sector 83', lat: 28.5453, lng: 77.3854, address: 'Sector 83, Noida' },
      { id: 'M-A-008', name: 'Noida Sector 137', lat: 28.5400, lng: 77.3950, address: 'Sector 137, Noida' },
      { id: 'M-A-009', name: 'Noida Sector 142', lat: 28.5353, lng: 77.4035, address: 'Sector 142, Noida' },
      { id: 'M-A-010', name: 'Noida Sector 143', lat: 28.5305, lng: 77.4119, address: 'Sector 143, Noida' },
      { id: 'M-A-011', name: 'Noida Sector 144', lat: 28.5257, lng: 77.4203, address: 'Sector 144, Noida' },
      { id: 'M-A-012', name: 'Noida Sector 145', lat: 28.5209, lng: 77.4287, address: 'Sector 145, Noida' },
      { id: 'M-A-013', name: 'Noida Sector 146', lat: 28.5161, lng: 77.4371, address: 'Sector 146, Noida' },
      { id: 'M-A-014', name: 'Noida Sector 147', lat: 28.5113, lng: 77.4455, address: 'Sector 147, Noida' },
      { id: 'M-A-015', name: 'Noida Sector 148', lat: 28.5065, lng: 77.4539, address: 'Sector 148, Noida' },
      { id: 'M-A-016', name: 'Knowledge Park II', lat: 28.4969, lng: 77.4707, address: 'Knowledge Park II, Greater Noida' },
      { id: 'M-A-017', name: 'Pari Chowk', lat: 28.4827, lng: 77.4849, address: 'Pari Chowk, Greater Noida' },
      { id: 'M-A-018', name: 'Alpha 1', lat: 28.4735, lng: 77.4904, address: 'Alpha 1, Greater Noida' },
      { id: 'M-A-019', name: 'Delta 1', lat: 28.4642, lng: 77.4959, address: 'Delta 1, Greater Noida' },
      { id: 'M-A-020', name: 'GNIDA Office', lat: 28.4550, lng: 77.5014, address: 'GNIDA Office, Greater Noida' },
      { id: 'M-A-021', name: 'Depot', lat: 28.4457, lng: 77.5069, address: 'Depot Station, Greater Noida' }
    ]
  },
  
  railway: [
    // Major Railway Stations
    { id: 'R-001', name: 'New Delhi Railway Station', lat: 28.6392, lng: 77.2182, address: 'Bhavbhuti Marg, Ajmeri Gate, New Delhi', type: 'railway', subType: 'major' },
    { id: 'R-002', name: 'Old Delhi Railway Station', lat: 28.6610, lng: 77.2300, address: 'Chandni Chowk, Old Delhi', type: 'railway', subType: 'major' },
    { id: 'R-003', name: 'Hazrat Nizamuddin Railway Station', lat: 28.5884, lng: 77.2542, address: 'Bhogal Road, Nizamuddin East, Delhi', type: 'railway', subType: 'major' },
    { id: 'R-004', name: 'Anand Vihar Terminal', lat: 28.6465, lng: 77.3166, address: 'Anand Vihar, East Delhi', type: 'railway', subType: 'major' },
    { id: 'R-005', name: 'Delhi Sarai Rohilla', lat: 28.6713, lng: 77.1899, address: 'Sarai Rohilla, Delhi', type: 'railway', subType: 'major' },
    
    // Delhi Ring Railway Stations
    { id: 'R-006', name: 'Delhi Cantonment', lat: 28.6039, lng: 77.1571, address: 'Delhi Cantonment, Delhi', type: 'railway', subType: 'ring' },
    { id: 'R-007', name: 'Patel Nagar', lat: 28.6449, lng: 77.1693, address: 'Patel Nagar, Delhi', type: 'railway', subType: 'ring' },
    { id: 'R-008', name: 'Delhi Kishan Ganj', lat: 28.6775, lng: 77.2045, address: 'Kishan Ganj, Delhi', type: 'railway', subType: 'ring' },
    { id: 'R-009', name: 'Dayabasti', lat: 28.6838, lng: 77.2271, address: 'Dayabasti, Delhi', type: 'railway', subType: 'ring' },
    { id: 'R-010', name: 'Vivek Vihar', lat: 28.6718, lng: 77.2861, address: 'Vivek Vihar, Delhi', type: 'railway', subType: 'ring' },
    { id: 'R-011', name: 'Mandawali Chander Vihar', lat: 28.6254, lng: 77.3039, address: 'Mandawali, Delhi', type: 'railway', subType: 'ring' },
    { id: 'R-012', name: 'New Ashok Nagar', lat: 28.5892, lng: 77.3018, address: 'New Ashok Nagar, Delhi', type: 'railway', subType: 'ring' },
    { id: 'R-013', name: 'Tuglakabad', lat: 28.5018, lng: 77.2985, address: 'Tughlakabad, Delhi', type: 'railway', subType: 'ring' },
    { id: 'R-014', name: 'Okhla', lat: 28.5346, lng: 77.2749, address: 'Okhla, Delhi', type: 'railway', subType: 'ring' },
    { id: 'R-015', name: 'Lajpat Nagar', lat: 28.5708, lng: 77.2365, address: 'Lajpat Nagar, Delhi', type: 'railway', subType: 'ring' },
    { id: 'R-016', name: 'Sewa Nagar', lat: 28.5881, lng: 77.2219, address: 'Sewa Nagar, Delhi', type: 'railway', subType: 'ring' },
    { id: 'R-017', name: 'Lodhi Colony', lat: 28.5830, lng: 77.2194, address: 'Lodhi Colony, Delhi', type: 'railway', subType: 'ring' },
    { id: 'R-018', name: 'Safdarjung', lat: 28.5738, lng: 77.2033, address: 'Safdarjung, Delhi', type: 'railway', subType: 'ring' },
    { id: 'R-019', name: 'Chanakyapuri', lat: 28.5915, lng: 77.1868, address: 'Chanakyapuri, Delhi', type: 'railway', subType: 'ring' },
    { id: 'R-020', name: 'Delhi Sarai Rohilla Motibagh', lat: 28.6063, lng: 77.1756, address: 'Motibagh, Delhi', type: 'railway', subType: 'ring' },
    { id: 'R-021', name: 'Daya Basti', lat: 28.6844, lng: 77.1925, address: 'Daya Basti, Delhi', type: 'railway', subType: 'ring' },
    
    // Other Important Stations
    { id: 'R-022', name: 'Delhi Azadpur', lat: 28.7066, lng: 77.1806, address: 'Azadpur, Delhi', type: 'railway', subType: 'other' },
    { id: 'R-023', name: 'Delhi Shakurbasti', lat: 28.6835, lng: 77.1455, address: 'Shakurbasti, Delhi', type: 'railway', subType: 'other' },
    { id: 'R-024', name: 'Subzi Mandi', lat: 28.6844, lng: 77.2055, address: 'Subzi Mandi, Delhi', type: 'railway', subType: 'other' },
    { id: 'R-025', name: 'Delhi Shahdara', lat: 28.6734, lng: 77.2894, address: 'Shahdara, Delhi', type: 'railway', subType: 'other' },
    { id: 'R-026', name: 'Sabzi Mandi', lat: 28.6877, lng: 77.2089, address: 'Sabzi Mandi, Delhi', type: 'railway', subType: 'other' },
    { id: 'R-027', name: 'Narela', lat: 28.8528, lng: 77.0923, address: 'Narela, Delhi', type: 'railway', subType: 'other' },
    { id: 'R-028', name: 'Holambi Kalan', lat: 28.8088, lng: 77.1063, address: 'Holambi Kalan, Delhi', type: 'railway', subType: 'other' },
    { id: 'R-029', name: 'Khera Kalan', lat: 28.7816, lng: 77.1095, address: 'Khera Kalan, Delhi', type: 'railway', subType: 'other' },
    { id: 'R-030', name: 'Kundli', lat: 28.8615, lng: 77.1149, address: 'Kundli, Delhi', type: 'railway', subType: 'other' },
    { id: 'R-031', name: 'Bhajan Pura', lat: 28.7090, lng: 77.2673, address: 'Bhajan Pura, Delhi', type: 'railway', subType: 'other' },
    { id: 'R-032', name: 'Ghaziabad', lat: 28.6670, lng: 77.4385, address: 'Ghaziabad Junction, UP', type: 'railway', subType: 'other' },
    { id: 'R-033', name: 'Faridabad', lat: 28.4082, lng: 77.3178, address: 'Faridabad, Haryana', type: 'railway', subType: 'other' },
    { id: 'R-034', name: 'Ballabhgarh', lat: 28.3425, lng: 77.3260, address: 'Ballabhgarh, Haryana', type: 'railway', subType: 'other' },
    { id: 'R-035', name: 'Palwal', lat: 28.1487, lng: 77.3255, address: 'Palwal, Haryana', type: 'railway', subType: 'other' },
    { id: 'R-036', name: 'Asaoti', lat: 28.2488, lng: 77.3422, address: 'Asaoti, Haryana', type: 'railway', subType: 'other' },
    { id: 'R-037', name: 'Badarpur', lat: 28.4933, lng: 77.3031, address: 'Badarpur, Delhi', type: 'railway', subType: 'other' },
    { id: 'R-038', name: 'Tilak Bridge', lat: 28.6363, lng: 77.2393, address: 'Tilak Bridge, Delhi', type: 'railway', subType: 'other' },
    { id: 'R-039', name: 'Shivaji Bridge', lat: 28.6507, lng: 77.2213, address: 'Shivaji Bridge, Delhi', type: 'railway', subType: 'other' },
    { id: 'R-040', name: 'Pragati Maidan', lat: 28.6232, lng: 77.2421, address: 'Pragati Maidan, Delhi', type: 'railway', subType: 'other' },
    { id: 'R-041', name: 'Nangloi', lat: 28.6843, lng: 77.0672, address: 'Nangloi, Delhi', type: 'railway', subType: 'other' },
    { id: 'R-042', name: 'Mundka', lat: 28.6823, lng: 77.0305, address: 'Mundka, Delhi', type: 'railway', subType: 'other' },
    { id: 'R-043', name: 'Basai Dhankot', lat: 28.6486, lng: 76.9994, address: 'Basai Dhankot, Delhi', type: 'railway', subType: 'other' },
    { id: 'R-044', name: 'Palam', lat: 28.5891, lng: 77.0843, address: 'Palam, Delhi', type: 'railway', subType: 'other' },
    { id: 'R-045', name: 'Shahbad Mohammadpur', lat: 28.5780, lng: 77.0542, address: 'Shahbad Mohammadpur, Delhi', type: 'railway', subType: 'other' },
    { id: 'R-046', name: 'Bijwasan', lat: 28.5093, lng: 77.0485, address: 'Bijwasan, Delhi', type: 'railway', subType: 'other' }
  ],
  
  airport: [
    { id: 'A-001', name: 'IGI Airport Terminal 1', lat: 28.5562, lng: 77.1003, address: 'Terminal 1, Indira Gandhi International Airport, Palam, Delhi', type: 'airport', subType: 'Terminal 1' },
    { id: 'A-002', name: 'IGI Airport Terminal 2', lat: 28.5495, lng: 77.0848, address: 'Terminal 2, Indira Gandhi International Airport, Palam, Delhi', type: 'airport', subType: 'Terminal 2' },
    { id: 'A-003', name: 'IGI Airport Terminal 3', lat: 28.5457, lng: 77.1092, address: 'Terminal 3, Indira Gandhi International Airport, Palam, Delhi', type: 'airport', subType: 'Terminal 3' }
  ]
};

// Helper functions

export const getAllPickupLocations = () => {
  const allLocations = [];
  
  // Add all metro stations
  Object.values(PICKUP_LOCATIONS.metro).forEach(line => {
    line.forEach(station => {
      allLocations.push({
        ...station,
        type: 'metro',
        subType: Object.keys(PICKUP_LOCATIONS.metro).find(key => 
          PICKUP_LOCATIONS.metro[key].includes(station)
        )
      });
    });
  });
  
  // Add all railway stations
  PICKUP_LOCATIONS.railway.forEach(station => {
    allLocations.push(station);
  });
  
  // Add all airport terminals
  PICKUP_LOCATIONS.airport.forEach(terminal => {
    allLocations.push(terminal);
  });
  
  return allLocations;
};

export const getPickupLocationsByType = (type) => {
  if (type === 'metro') {
    const metroStations = [];
    Object.values(PICKUP_LOCATIONS.metro).forEach(line => {
      line.forEach(station => {
        metroStations.push({
          ...station,
          type: 'metro',
          subType: Object.keys(PICKUP_LOCATIONS.metro).find(key => 
            PICKUP_LOCATIONS.metro[key].includes(station)
          )
        });
      });
    });
    return metroStations;
  }
  
  return PICKUP_LOCATIONS[type] || [];
};

export const getMetroStationsByLine = (lineName) => {
  return PICKUP_LOCATIONS.metro[lineName.toLowerCase()] || [];
};

export const searchPickupLocations = (searchText) => {
  const searchLower = searchText.toLowerCase();
  const allLocations = getAllPickupLocations();
  
  return allLocations.filter(location => 
    location.name.toLowerCase().includes(searchLower) ||
    location.address.toLowerCase().includes(searchLower) ||
    (location.subType && location.subType.toLowerCase().includes(searchLower))
  );
};

export const findNearestPickupLocation = (lat, lng, type = null) => {
  const locations = type ? getPickupLocationsByType(type) : getAllPickupLocations();
  let nearestLocation = null;
  let minDistance = Infinity;
  
  locations.forEach(location => {
    const distance = calculateDistance(lat, lng, location.lat, location.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearestLocation = location;
    }
  });
  
  return { location: nearestLocation, distance: minDistance };
};

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Radius of Earth in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI/180);
}

// Metro line colors for UI
export const METRO_LINE_COLORS = {
  red: '#EF4444',
  yellow: '#EAB308',
  blue: '#3B82F6',
  green: '#22C55E',
  violet: '#8B5CF6',
  pink: '#EC4899',
  magenta: '#E11D48',
  orange: '#F97316',
  grey: '#6B7280',
  aqua: '#06B6D4'
};

// Statistics
export const PICKUP_LOCATION_STATS = {
  totalLocations: getAllPickupLocations().length,
  metroStations: getPickupLocationsByType('metro').length,
  railwayStations: PICKUP_LOCATIONS.railway.length,
  airportTerminals: PICKUP_LOCATIONS.airport.length,
  metroLines: Object.keys(PICKUP_LOCATIONS.metro).length
};