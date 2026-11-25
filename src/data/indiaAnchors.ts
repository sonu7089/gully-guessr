import type { Anchor, Archetype, StateCode } from '../engine/types';

/**
 * India Geographic Anchor Atlas.
 *
 * Compact rows: [name, state, lat, lng, archetype code, jitterRadiusKm?]
 *   U = urban_town, H = highway_corridor, R = rural_settlement,
 *   S = scenic_coastal_hill, F = forest_wilderness, M = metro neighbourhood (urban_town + metro flag)
 * When jitter is omitted, the archetype default is used.
 */
type Code = 'U' | 'H' | 'R' | 'S' | 'F' | 'M';
type Row = [string, StateCode, number, number, Code, number?];

const CODE_TO_ARCHETYPE: Record<Code, Archetype> = {
  U: 'urban_town',
  M: 'urban_town',
  H: 'highway_corridor',
  R: 'rural_settlement',
  S: 'scenic_coastal_hill',
  F: 'forest_wilderness',
};

export const DEFAULT_JITTER_KM: Record<Code, number> = { U: 5, M: 3, H: 15, R: 12, S: 6, F: 5 };

const ROWS: Row[] = [
  // Andhra Pradesh
  ['Visakhapatnam', 'AP', 17.6868, 83.2185, 'U', 6], ['Vijayawada', 'AP', 16.5062, 80.648, 'U', 6], ['Guntur', 'AP', 16.3067, 80.4365, 'U'],
  ['Tirupati', 'AP', 13.6288, 79.4192, 'U'], ['Kurnool', 'AP', 15.8281, 78.0373, 'U'], ['Nellore', 'AP', 14.4426, 79.9865, 'U'],
  ['Anantapur', 'AP', 14.6819, 77.6006, 'U'], ['Kakinada', 'AP', 16.9891, 82.2475, 'U', 4], ['Rajahmundry', 'AP', 17.0005, 81.804, 'U'],
  ['NH16 near Ongole', 'AP', 15.5057, 80.0499, 'H'], ['NH44 near Penukonda', 'AP', 14.0835, 77.5966, 'H'], ['Bhimavaram', 'AP', 16.5449, 81.5212, 'R'],
  ['Madanapalle', 'AP', 13.5503, 78.5029, 'R'], ['Araku Valley', 'AP', 18.3273, 82.8775, 'S'], ['Nallamala ghat road', 'AP', 16.02, 78.9, 'F', 6],
  // Arunachal Pradesh
  ['Itanagar', 'AR', 27.0844, 93.6053, 'U', 4], ['Pasighat', 'AR', 28.07, 95.33, 'U'], ['Aalo', 'AR', 28.163, 94.8, 'U'], ['Tezu', 'AR', 27.917, 96.164, 'U'],
  ['Tawang', 'AR', 27.586, 91.859, 'S', 4], ['Bomdila', 'AR', 27.2645, 92.4159, 'S', 4], ['Ziro', 'AR', 27.545, 93.831, 'R', 6], ['Roing', 'AR', 28.144, 95.844, 'R'],
  ['Trans-Arunachal Highway, Doimukh', 'AR', 27.15, 93.75, 'H', 10], ['Namdapha road, Miao', 'AR', 27.48, 96.25, 'F', 6],
  // Assam
  ['Guwahati', 'AS', 26.1445, 91.7362, 'U', 8], ['Dibrugarh', 'AS', 27.4728, 94.912, 'U'], ['Jorhat', 'AS', 26.7509, 94.2037, 'U'], ['Silchar', 'AS', 24.8333, 92.7789, 'U'],
  ['Tezpur', 'AS', 26.6338, 92.8, 'U'], ['Nagaon', 'AS', 26.348, 92.684, 'U'], ['NH27 near Bongaigaon', 'AS', 26.477, 90.558, 'H'], ['NH27 near Nalbari', 'AS', 26.445, 91.44, 'H'],
  ['Majuli', 'AS', 26.95, 94.167, 'R', 10], ['Barpeta', 'AS', 26.323, 91.005, 'R'], ['Sivasagar', 'AS', 26.985, 94.637, 'R'], ['Haflong', 'AS', 25.169, 93.016, 'S', 4],
  ['Kaziranga NH715 corridor', 'AS', 26.6, 93.42, 'F', 8],
  // Bihar
  ['Patna', 'BR', 25.5941, 85.1376, 'U', 8], ['Gaya', 'BR', 24.7914, 85.0002, 'U'], ['Bhagalpur', 'BR', 25.2425, 86.9842, 'U'], ['Muzaffarpur', 'BR', 26.1209, 85.3647, 'U'],
  ['Darbhanga', 'BR', 26.1542, 85.8918, 'U'], ['Purnia', 'BR', 25.7771, 87.4753, 'U'], ['Arrah', 'BR', 25.556, 84.66, 'U'], ['NH19 near Sasaram', 'BR', 24.95, 84.03, 'H'],
  ['NH27 near Gopalganj', 'BR', 26.468, 84.44, 'H'], ['Madhubani', 'BR', 26.348, 86.071, 'R'], ['Begusarai', 'BR', 25.418, 86.129, 'R'], ['Samastipur', 'BR', 25.863, 85.781, 'R'],
  ['Rajgir', 'BR', 25.028, 85.42, 'S', 4], ['Valmiki Tiger Reserve road', 'BR', 27.34, 84.15, 'F', 6],
  // Chhattisgarh
  ['Raipur', 'CG', 21.2514, 81.6296, 'U', 7], ['Bilaspur', 'CG', 22.0797, 82.1409, 'U'], ['Durg–Bhilai', 'CG', 21.1938, 81.3509, 'U'], ['Jagdalpur', 'CG', 19.0748, 82.008, 'U'],
  ['Ambikapur', 'CG', 23.118, 83.195, 'U'], ['NH30 near Kanker', 'CG', 20.272, 81.492, 'H'], ['NH53 near Rajnandgaon', 'CG', 21.097, 81.03, 'H'], ['Dhamtari', 'CG', 20.707, 81.549, 'R'],
  ['Korba', 'CG', 22.3595, 82.7501, 'R'], ['Chitrakote', 'CG', 19.2065, 81.701, 'S', 4], ['Mainpat', 'CG', 22.8167, 83.2833, 'S', 5],
  // Goa
  ['Panaji', 'GA', 15.4909, 73.8278, 'U', 3], ['Margao', 'GA', 15.2832, 73.9862, 'U', 4], ['Mapusa', 'GA', 15.5915, 73.809, 'U', 3], ['Vasco da Gama', 'GA', 15.398, 73.811, 'U', 3],
  ['Ponda', 'GA', 15.403, 74.015, 'R', 6], ['Palolem coast road', 'GA', 15.01, 74.023, 'S', 4], ['Calangute', 'GA', 15.544, 73.763, 'S', 3], ['NH66 near Pernem', 'GA', 15.72, 73.8, 'H', 6],
  ['Mollem ghat (NH748)', 'GA', 15.37, 74.24, 'F', 5],
  // Gujarat
  ['Surat', 'GJ', 21.1702, 72.8311, 'U', 7], ['Vadodara', 'GJ', 22.3072, 73.1812, 'U', 6], ['Rajkot', 'GJ', 22.3039, 70.8022, 'U', 6], ['Bhavnagar', 'GJ', 21.7645, 72.1519, 'U'],
  ['Jamnagar', 'GJ', 22.4707, 70.0577, 'U'], ['Junagadh', 'GJ', 21.5222, 70.4579, 'U'], ['Bhuj', 'GJ', 23.242, 69.6669, 'U'], ['Gandhinagar', 'GJ', 23.2156, 72.6369, 'U'],
  ['Anand', 'GJ', 22.5645, 72.9289, 'U'], ['NH48 near Bharuch', 'GJ', 21.7131, 72.9939, 'H'], ['NH27 near Morbi', 'GJ', 22.8173, 70.837, 'H'], ['NH47 near Limbdi', 'GJ', 22.57, 71.81, 'H'],
  ['Mehsana', 'GJ', 23.588, 72.3693, 'R'], ['Amreli', 'GJ', 21.6032, 71.2221, 'R'], ['Godhra', 'GJ', 22.7788, 73.6143, 'R'], ['Dwarka', 'GJ', 22.2482, 68.9745, 'S', 4],
  ['Veraval–Somnath', 'GJ', 20.915, 70.369, 'S', 4], ['Saputara', 'GJ', 20.575, 73.747, 'S', 4], ['Gir forest road, Sasan', 'GJ', 21.17, 70.6, 'F', 6],
  // Haryana
  ['Faridabad', 'HR', 28.4089, 77.3178, 'U'], ['Panipat', 'HR', 29.3909, 76.9635, 'U'], ['Ambala', 'HR', 30.3782, 76.7767, 'U'], ['Hisar', 'HR', 29.1492, 75.7217, 'U'],
  ['Rohtak', 'HR', 28.8955, 76.6066, 'U'], ['Karnal', 'HR', 29.6857, 76.9905, 'U'], ['NH44 near Sonipat', 'HR', 29.0, 77.02, 'H'], ['NH48 near Rewari', 'HR', 28.199, 76.619, 'H'],
  ['Jind', 'HR', 29.316, 76.315, 'R'], ['Sirsa', 'HR', 29.533, 75.017, 'R'], ['Kurukshetra', 'HR', 29.9695, 76.8783, 'R'], ['Morni Hills', 'HR', 30.695, 77.087, 'S', 5],
  // Himachal Pradesh
  ['Shimla', 'HP', 31.1048, 77.1734, 'U', 3], ['Dharamshala', 'HP', 32.219, 76.3234, 'U', 4], ['Mandi', 'HP', 31.708, 76.9318, 'U', 4], ['Solan', 'HP', 30.9045, 77.0967, 'U', 4],
  ['Hamirpur', 'HP', 31.6862, 76.5213, 'U', 4], ['NH5 near Rampur Bushahr', 'HP', 31.452, 77.63, 'H', 10], ['NH205 near Bilaspur', 'HP', 31.339, 76.76, 'H', 10], ['Palampur', 'HP', 32.11, 76.536, 'R', 8],
  ['Una', 'HP', 31.4685, 76.2708, 'R', 8], ['Manali', 'HP', 32.2432, 77.1892, 'S', 4], ['Kullu', 'HP', 31.958, 77.109, 'S', 4], ['Dalhousie', 'HP', 32.5387, 75.971, 'S', 3],
  ['Kaza, Spiti', 'HP', 32.227, 78.072, 'S', 6], ['Narkanda deodar road', 'HP', 31.265, 77.46, 'S', 5],
  // Jharkhand
  ['Ranchi', 'JH', 23.3441, 85.3096, 'U', 7], ['Jamshedpur', 'JH', 22.8046, 86.2029, 'U', 6], ['Dhanbad', 'JH', 23.7957, 86.4304, 'U'], ['Bokaro', 'JH', 23.6693, 86.1511, 'U'],
  ['Hazaribagh', 'JH', 23.9925, 85.3637, 'U'], ['Deoghar', 'JH', 24.482, 86.695, 'U'], ['NH19 near Barhi', 'JH', 24.3, 85.42, 'H'], ['Gumla', 'JH', 23.044, 84.538, 'R'],
  ['Dumka', 'JH', 24.268, 87.249, 'R'], ['Netarhat', 'JH', 23.48, 84.27, 'S', 5], ['Betla forest road, Palamu', 'JH', 23.89, 84.19, 'F', 6],
  // Karnataka
  ['Mysuru', 'KA', 12.2958, 76.6394, 'U', 6], ['Mangaluru', 'KA', 12.9141, 74.856, 'U', 4], ['Hubballi', 'KA', 15.3647, 75.124, 'U', 6], ['Belagavi', 'KA', 15.8497, 74.4977, 'U'],
  ['Kalaburagi', 'KA', 17.3297, 76.8343, 'U'], ['Davanagere', 'KA', 14.4644, 75.9218, 'U'], ['Ballari', 'KA', 15.1394, 76.9214, 'U'], ['Shivamogga', 'KA', 13.9299, 75.5681, 'U'],
  ['Vijayapura', 'KA', 16.8302, 75.71, 'U'], ['Udupi', 'KA', 13.3409, 74.7421, 'U', 3], ['Bidar', 'KA', 17.9104, 77.5199, 'U'], ['NH48 near Chitradurga', 'KA', 14.2251, 76.398, 'H'],
  ['NH75 near Kolar', 'KA', 13.137, 78.129, 'H'], ['NH50 near Hosapete', 'KA', 15.2689, 76.3909, 'H'], ['Mandya', 'KA', 12.5218, 76.8951, 'R'], ['Hassan', 'KA', 13.0072, 76.096, 'R'],
  ['Gadag', 'KA', 15.4315, 75.6355, 'R'], ['Hampi', 'KA', 15.335, 76.46, 'S', 4], ['Madikeri, Kodagu', 'KA', 12.4244, 75.7382, 'S', 5], ['Gokarna', 'KA', 14.5479, 74.3188, 'S', 3],
  ['Chikkamagaluru', 'KA', 13.3153, 75.7754, 'S', 5], ['Bandipur NH766', 'KA', 11.67, 76.63, 'F', 5], ['Dandeli', 'KA', 15.2499, 74.6176, 'R', 6], ['Agumbe ghat', 'KA', 13.51, 75.09, 'S', 4],
  // Kerala
  ['Thiruvananthapuram', 'KL', 8.5241, 76.9366, 'U', 5], ['Kochi', 'KL', 9.9816, 76.2999, 'U', 4], ['Kozhikode', 'KL', 11.2588, 75.7804, 'U', 4], ['Thrissur', 'KL', 10.5276, 76.2144, 'U', 5],
  ['Kollam', 'KL', 8.8932, 76.6141, 'U', 4], ['Kannur', 'KL', 11.8745, 75.3704, 'U', 4], ['Palakkad', 'KL', 10.7867, 76.6548, 'U'], ['Kottayam', 'KL', 9.5916, 76.5222, 'U'],
  ['NH66 near Kasaragod', 'KL', 12.4996, 74.9869, 'H', 8], ['NH544 near Angamaly', 'KL', 10.196, 76.386, 'H', 10], ['Alappuzha', 'KL', 9.4981, 76.3388, 'R', 6], ['Malappuram', 'KL', 11.051, 76.0711, 'R', 8],
  ['Munnar', 'KL', 10.0889, 77.0595, 'S', 5], ['Varkala', 'KL', 8.7379, 76.7163, 'S', 3], ['Kalpetta, Wayanad', 'KL', 11.605, 76.083, 'S', 6], ['Kumily–Periyar road', 'KL', 9.6, 77.17, 'F', 5],
  // Madhya Pradesh
  ['Bhopal', 'MP', 23.2599, 77.4126, 'U', 7], ['Indore', 'MP', 22.7196, 75.8577, 'U', 7], ['Jabalpur', 'MP', 23.1815, 79.9864, 'U', 6], ['Gwalior', 'MP', 26.2183, 78.1828, 'U', 6],
  ['Ujjain', 'MP', 23.1765, 75.7885, 'U'], ['Sagar', 'MP', 23.8388, 78.7378, 'U'], ['Rewa', 'MP', 24.5373, 81.3042, 'U'], ['Satna', 'MP', 24.6005, 80.8322, 'U'],
  ['Ratlam', 'MP', 23.3315, 75.0367, 'U'], ['NH46 near Betul', 'MP', 21.905, 77.9, 'H'], ['NH44 near Seoni', 'MP', 22.087, 79.543, 'H'], ['NH52 near Dewas', 'MP', 22.9676, 76.0534, 'H'],
  ['NH46 near Itarsi', 'MP', 22.6139, 77.7621, 'H'], ['Vidisha', 'MP', 23.5251, 77.8081, 'R'], ['Chhindwara', 'MP', 22.0574, 78.9382, 'R'], ['Shivpuri', 'MP', 25.4358, 77.6651, 'R'],
  ['Pachmarhi', 'MP', 22.4674, 78.4346, 'S', 4], ['Khajuraho', 'MP', 24.8318, 79.9199, 'S', 4], ['Orchha', 'MP', 25.351, 78.64, 'S', 3], ['Mandu', 'MP', 22.357, 75.397, 'S', 3],
  ['Kanha road, Mandla', 'MP', 22.28, 80.61, 'F', 6], ['Pench NH44 corridor', 'MP', 21.75, 79.28, 'F', 6],
  // Maharashtra
  ['Nagpur', 'MH', 21.1458, 79.0882, 'U', 7], ['Nashik', 'MH', 19.9975, 73.7898, 'U', 6], ['Chhatrapati Sambhajinagar', 'MH', 19.8762, 75.3433, 'U', 6], ['Solapur', 'MH', 17.6599, 75.9064, 'U'],
  ['Kolhapur', 'MH', 16.705, 74.2433, 'U'], ['Amravati', 'MH', 20.9374, 77.7796, 'U'], ['Nanded', 'MH', 19.1383, 77.321, 'U'], ['Akola', 'MH', 20.7002, 77.0082, 'U'],
  ['Jalgaon', 'MH', 21.0077, 75.5626, 'U'], ['Latur', 'MH', 18.4088, 76.5604, 'U'], ['Mumbai–Pune Expressway, Lonavala', 'MH', 18.75, 73.407, 'H', 10], ['NH44 near Wardha', 'MH', 20.7453, 78.6022, 'H'],
  ['NH160 near Ahilyanagar', 'MH', 19.0948, 74.748, 'H'], ['NH48 near Satara', 'MH', 17.6805, 74.0183, 'H'], ['Beed', 'MH', 18.9891, 75.7601, 'R'], ['Yavatmal', 'MH', 20.3888, 78.1204, 'R'],
  ['Baramati', 'MH', 18.1515, 74.5777, 'R'], ['Ratnagiri', 'MH', 16.9902, 73.312, 'S', 4], ['Mahabaleshwar', 'MH', 17.9237, 73.6586, 'S', 4], ['Alibag', 'MH', 18.6434, 72.8762, 'S', 3],
  ['Tadoba forest road', 'MH', 20.25, 79.35, 'F', 6], ['Chikhaldara', 'MH', 21.4, 77.32, 'S', 5],
  // Manipur
  ['Imphal', 'MN', 24.817, 93.9368, 'U', 5], ['Churachandpur', 'MN', 24.333, 93.683, 'U', 4], ['Thoubal', 'MN', 24.638, 94.013, 'R', 6], ['Bishnupur', 'MN', 24.6, 93.76, 'R', 6],
  ['Ukhrul', 'MN', 25.05, 94.36, 'S', 4], ['Moirang, Loktak', 'MN', 24.5, 93.77, 'S', 5], ['NH2 near Kangpokpi', 'MN', 25.15, 93.97, 'H', 8],
  // Meghalaya
  ['Shillong', 'ML', 25.5788, 91.8933, 'U', 5], ['Tura', 'ML', 25.5138, 90.2036, 'U', 4], ['Jowai', 'ML', 25.45, 92.2, 'U', 4], ['NH6 near Nongpoh', 'ML', 25.9, 91.88, 'H', 8],
  ['Nongstoin', 'ML', 25.517, 91.267, 'R', 6], ['Sohra (Cherrapunji)', 'ML', 25.2702, 91.7323, 'S', 4], ['Dawki', 'ML', 25.186, 92.02, 'S', 3],
  // Mizoram
  ['Aizawl', 'MZ', 23.7271, 92.7176, 'U', 4], ['Lunglei', 'MZ', 22.88, 92.734, 'U', 4], ['Kolasib', 'MZ', 24.224, 92.676, 'R', 5], ['Serchhip', 'MZ', 23.3, 92.85, 'R', 5],
  ['Champhai', 'MZ', 23.456, 93.328, 'S', 5], ['NH306 near Bairabi road', 'MZ', 24.0, 92.62, 'H', 8],
  // Nagaland
  ['Kohima', 'NL', 25.6751, 94.1086, 'U', 4], ['Dimapur', 'NL', 25.9091, 93.7266, 'U', 5], ['Mokokchung', 'NL', 26.32, 94.52, 'U', 4], ['Tuensang', 'NL', 26.28, 94.83, 'R', 5],
  ['Wokha', 'NL', 26.1, 94.27, 'R', 5], ['NH29 near Chümoukedima', 'NL', 25.79, 93.78, 'H', 6], ['Viswema', 'NL', 25.58, 94.12, 'S', 4], ['Mon', 'NL', 26.75, 95.1, 'S', 4],
  // Odisha
  ['Bhubaneswar', 'OD', 20.2961, 85.8245, 'U', 7], ['Cuttack', 'OD', 20.4625, 85.883, 'U', 5], ['Rourkela', 'OD', 22.2604, 84.8536, 'U'], ['Sambalpur', 'OD', 21.4669, 83.9812, 'U'],
  ['Berhampur', 'OD', 19.315, 84.7941, 'U'], ['Balasore', 'OD', 21.4934, 86.9135, 'U'], ['NH16 near Chandikhol', 'OD', 20.712, 86.12, 'H'], ['NH53 near Bargarh', 'OD', 21.333, 83.619, 'H'],
  ['Koraput', 'OD', 18.812, 82.711, 'R'], ['Bhadrak', 'OD', 21.058, 86.496, 'R'], ['Angul', 'OD', 20.8444, 85.1511, 'R'], ['Puri', 'OD', 19.8135, 85.8312, 'S', 4],
  ['Konark', 'OD', 19.8876, 86.0945, 'S', 4], ['Gopalpur-on-Sea', 'OD', 19.26, 84.91, 'S', 3], ['Simlipal forest road', 'OD', 21.83, 86.3, 'F', 6],
  // Punjab
  ['Ludhiana', 'PB', 30.901, 75.8573, 'U', 7], ['Amritsar', 'PB', 31.634, 74.8723, 'U', 5], ['Jalandhar', 'PB', 31.326, 75.5762, 'U'], ['Patiala', 'PB', 30.3398, 76.3869, 'U'],
  ['Bathinda', 'PB', 30.211, 74.9455, 'U'], ['Mohali', 'PB', 30.7046, 76.7179, 'U', 4], ['Pathankot', 'PB', 32.2643, 75.6421, 'U', 4], ['NH44 near Rajpura', 'PB', 30.484, 76.594, 'H'],
  ['NH54 near Moga', 'PB', 30.816, 75.171, 'H'], ['Sangrur', 'PB', 30.245, 75.842, 'R'], ['Hoshiarpur', 'PB', 31.532, 75.911, 'R'], ['Fazilka', 'PB', 30.402, 74.028, 'R', 6],
  ['Anandpur Sahib', 'PB', 31.239, 76.498, 'S', 4],
  // Rajasthan
  ['Jaipur', 'RJ', 26.9124, 75.7873, 'U', 8], ['Jodhpur', 'RJ', 26.2389, 73.0243, 'U', 6], ['Udaipur', 'RJ', 24.5854, 73.7125, 'U', 5], ['Kota', 'RJ', 25.2138, 75.8648, 'U', 6],
  ['Bikaner', 'RJ', 28.0229, 73.3119, 'U', 5], ['Ajmer', 'RJ', 26.4499, 74.6399, 'U'], ['Alwar', 'RJ', 27.553, 76.6346, 'U'], ['Bhilwara', 'RJ', 25.3407, 74.6313, 'U'],
  ['Sikar', 'RJ', 27.6094, 75.1399, 'U'], ['Jaisalmer', 'RJ', 26.9157, 70.9083, 'U', 4], ['Sri Ganganagar', 'RJ', 29.9038, 73.8772, 'U', 4], ['NH48 near Kishangarh', 'RJ', 26.59, 74.86, 'H'],
  ['NH62 near Pali', 'RJ', 25.7711, 73.3234, 'H'], ['NH11 near Fatehpur', 'RJ', 28.0, 74.95, 'H'], ['NH27 near Chittorgarh', 'RJ', 24.8887, 74.6269, 'H'], ['Barmer', 'RJ', 25.75, 71.39, 'R'],
  ['Nagaur', 'RJ', 27.202, 73.733, 'R'], ['Bundi', 'RJ', 25.438, 75.637, 'R'], ['Tonk', 'RJ', 26.167, 75.79, 'R'], ['Jhunjhunu', 'RJ', 28.1289, 75.3995, 'R'],
  ['Mount Abu', 'RJ', 24.5926, 72.7156, 'S', 4], ['Pushkar', 'RJ', 26.4897, 74.5511, 'S', 3], ['Kumbhalgarh', 'RJ', 25.15, 73.58, 'S', 5], ['Ranthambore road', 'RJ', 26.02, 76.45, 'F', 5],
  // Sikkim
  ['Gangtok', 'SK', 27.3389, 88.6065, 'U', 3], ['Namchi', 'SK', 27.166, 88.364, 'U', 3], ['NH10 near Rangpo', 'SK', 27.176, 88.53, 'H', 6], ['Mangan', 'SK', 27.51, 88.53, 'R', 5],
  ['Pelling', 'SK', 27.3, 88.24, 'S', 4], ['Lachung', 'SK', 27.689, 88.744, 'S', 4],
  // Tamil Nadu
  ['Coimbatore', 'TN', 11.0168, 76.9558, 'U', 7], ['Madurai', 'TN', 9.9252, 78.1198, 'U', 6], ['Tiruchirappalli', 'TN', 10.7905, 78.7047, 'U', 6], ['Salem', 'TN', 11.6643, 78.146, 'U'],
  ['Tirunelveli', 'TN', 8.7139, 77.7567, 'U'], ['Vellore', 'TN', 12.9165, 79.1325, 'U'], ['Erode', 'TN', 11.341, 77.7172, 'U'], ['Thoothukudi', 'TN', 8.7642, 78.1348, 'U', 4],
  ['Thanjavur', 'TN', 10.787, 79.1378, 'U'], ['Tiruppur', 'TN', 11.1085, 77.3411, 'U'], ['Nagercoil', 'TN', 8.1833, 77.4119, 'U', 4], ['NH44 near Krishnagiri', 'TN', 12.5266, 78.215, 'H'],
  ['NH38 near Dindigul', 'TN', 10.3673, 77.9803, 'H'], ['NH44 near Namakkal', 'TN', 11.2189, 78.1677, 'H'], ['Villupuram', 'TN', 11.9401, 79.4861, 'R'], ['Pudukkottai', 'TN', 10.3833, 78.8001, 'R'],
  ['Karaikudi', 'TN', 10.074, 78.78, 'R'], ['Mamallapuram ECR', 'TN', 12.6208, 80.1945, 'S', 4], ['Ooty', 'TN', 11.4102, 76.695, 'S', 4], ['Kodaikanal', 'TN', 10.2381, 77.4892, 'S', 4],
  ['Rameswaram', 'TN', 9.2876, 79.3129, 'S', 3], ['Kanyakumari', 'TN', 8.0883, 77.5385, 'S', 3],   ['Mudumalai, Theppakadu', 'TN', 11.58, 76.58, 'F', 5],
    ['Valparai', 'TN', 10.326, 76.955, 'S', 4],
  // Telangana
  ['Warangal', 'TG', 17.9689, 79.5941, 'U', 6], ['Karimnagar', 'TG', 18.4386, 79.1288, 'U'], ['Nizamabad', 'TG', 18.6725, 78.0941, 'U'], ['Khammam', 'TG', 17.2473, 80.1514, 'U'],
  ['Nalgonda', 'TG', 17.0575, 79.2671, 'U'], ['NH44 near Adilabad', 'TG', 19.6641, 78.532, 'H'], ['NH65 near Suryapet', 'TG', 17.14, 79.62, 'H'], ['Siddipet', 'TG', 18.1018, 78.852, 'R'],
  ['Mahabubnagar', 'TG', 16.7488, 77.985, 'R'], ['Bhadrachalam', 'TG', 17.6688, 80.8936, 'S', 4], ['Amrabad forest road (NH765)', 'TG', 16.38, 78.83, 'F', 6],
  // Tripura
  ['Agartala', 'TR', 23.8315, 91.2868, 'U', 4], ['Udaipur (Tripura)', 'TR', 23.533, 91.483, 'U', 4], ['Dharmanagar', 'TR', 24.366, 92.16, 'U', 4], ['NH8 near Teliamura', 'TR', 23.75, 91.63, 'H', 8],
  ['Kailashahar', 'TR', 24.33, 92.0, 'R', 5], ['Belonia', 'TR', 23.25, 91.45, 'R', 5], ['Neermahal, Melaghar', 'TR', 23.5, 91.32, 'S', 4],
  // Uttar Pradesh
  ['Lucknow', 'UP', 26.8467, 80.9462, 'U', 8], ['Kanpur', 'UP', 26.4499, 80.3319, 'U', 7], ['Varanasi', 'UP', 25.3176, 82.9739, 'U', 5], ['Agra', 'UP', 27.1767, 78.0081, 'U', 6],
  ['Prayagraj', 'UP', 25.4358, 81.8463, 'U', 6], ['Meerut', 'UP', 28.9845, 77.7064, 'U'], ['Ghaziabad', 'UP', 28.6692, 77.4538, 'U'], ['Bareilly', 'UP', 28.367, 79.4304, 'U'],
  ['Aligarh', 'UP', 27.8974, 78.088, 'U'], ['Gorakhpur', 'UP', 26.7606, 83.3732, 'U'], ['Moradabad', 'UP', 28.8386, 78.7733, 'U'], ['Jhansi', 'UP', 25.4484, 78.5685, 'U'],
  ['Ayodhya', 'UP', 26.7922, 82.1998, 'U'], ['Mathura', 'UP', 27.4924, 77.6737, 'U'], ['NH19 near Etawah', 'UP', 26.7856, 79.0158, 'H'], ['NH27 near Basti', 'UP', 26.8, 82.73, 'H'],
  ['Agra–Lucknow Expressway, Kannauj', 'UP', 27.05, 79.92, 'H'], ['NH44 near Lalitpur', 'UP', 24.6878, 78.418, 'H'], ['NH19 near Mirzapur', 'UP', 25.1460, 82.5690, 'H'], ['Sitapur', 'UP', 27.568, 80.683, 'R'],
  ['Azamgarh', 'UP', 26.068, 83.184, 'R'], ['Banda', 'UP', 25.476, 80.335, 'R'], ['Bahraich', 'UP', 27.574, 81.595, 'R'], ['Shahjahanpur', 'UP', 27.883, 79.912, 'R'],
  ['Ballia', 'UP', 25.76, 84.147, 'R'], ['Dudhwa forest road', 'UP', 28.48, 80.65, 'F', 6],
  // Uttarakhand
  ['Dehradun', 'UK', 30.3165, 78.0322, 'U', 5], ['Haridwar', 'UK', 29.9457, 78.1642, 'U', 4], ['Haldwani', 'UK', 29.2183, 79.513, 'U', 4], ['Roorkee', 'UK', 29.8543, 77.888, 'U', 4],
  ['NH7 near Srinagar (Garhwal)', 'UK', 30.223, 78.783, 'H', 8], ['NH34 near Uttarkashi', 'UK', 30.7268, 78.4354, 'H', 8], ['Rudrapur', 'UK', 28.98, 79.4, 'R'], ['Pithoragarh', 'UK', 29.5829, 80.2182, 'R', 6],
  ['Rishikesh', 'UK', 30.0869, 78.2676, 'S', 4], ['Nainital', 'UK', 29.3803, 79.4636, 'S', 3], ['Mussoorie', 'UK', 30.4598, 78.0644, 'S', 3], ['Almora', 'UK', 29.5971, 79.6591, 'S', 4],
  ['Joshimath', 'UK', 30.555, 79.564, 'S', 4], ['Corbett forest road, Ramnagar', 'UK', 29.42, 79.05, 'F', 5], ['Rajaji corridor (NH334)', 'UK', 30.08, 78.1, 'F', 5],
  // West Bengal
  ['Siliguri', 'WB', 26.7271, 88.3953, 'U', 5], ['Durgapur', 'WB', 23.5204, 87.3119, 'U'], ['Asansol', 'WB', 23.6739, 86.9524, 'U'], ['Kharagpur', 'WB', 22.346, 87.232, 'U'],
  ['Bardhaman', 'WB', 23.2324, 87.8615, 'U'], ['Malda', 'WB', 25.0108, 88.1411, 'U'], ['Cooch Behar', 'WB', 26.324, 89.451, 'U', 4], ['NH19 near Panagarh', 'WB', 23.45, 87.43, 'H'],
  ['NH12 near Krishnanagar', 'WB', 23.4058, 88.49, 'H'], ['Bankura', 'WB', 23.2324, 87.071, 'R'], ['Purulia', 'WB', 23.332, 86.365, 'R'], ['Murshidabad', 'WB', 24.18, 88.27, 'R'],
  ['Darjeeling', 'WB', 27.041, 88.2663, 'S', 3], ['Kalimpong', 'WB', 27.06, 88.47, 'S', 3], ['Digha', 'WB', 21.627, 87.509, 'S', 3], ['Dooars, Lataguri NH717', 'WB', 26.71, 88.78, 'F', 5],
  // Andaman & Nicobar Islands
  ['Port Blair', 'AN', 11.6234, 92.7265, 'U', 3], ['Swaraj Dweep (Havelock)', 'AN', 11.97, 92.99, 'S', 2], ['Rangat', 'AN', 12.5, 92.93, 'R', 3], ['Mayabunder', 'AN', 12.902, 92.908, 'R', 3],
  ['Diglipur', 'AN', 13.27, 93.0, 'R', 3],
  // Chandigarh
  ['Chandigarh', 'CH', 30.7333, 76.7794, 'U', 4], ['Sukhna Lake, Chandigarh', 'CH', 30.7421, 76.8188, 'S', 2],
  // Dadra & Nagar Haveli and Daman & Diu
  ['Silvassa', 'DD', 20.2763, 73.0083, 'U', 4], ['Daman', 'DD', 20.3974, 72.8328, 'S', 2], ['Diu', 'DD', 20.7184, 70.9834, 'S', 2],
  // Delhi
  ['Narela', 'DL', 28.8526, 77.0929, 'R', 4], ['NH48 near Mahipalpur', 'DL', 28.5450, 77.1250, 'H', 4],
  // Jammu & Kashmir
  ['Srinagar', 'JK', 34.0837, 74.7973, 'U', 5], ['Jammu', 'JK', 32.7266, 74.857, 'U', 5], ['Anantnag', 'JK', 33.7311, 75.1487, 'U', 4], ['Baramulla', 'JK', 34.198, 74.3636, 'U', 4],
  ['Udhampur', 'JK', 32.916, 75.1416, 'U', 4], ['NH44 near Banihal', 'JK', 33.43, 75.2, 'H', 8], ['Pulwama', 'JK', 33.8716, 74.8946, 'R', 6], ['Kupwara', 'JK', 34.526, 74.255, 'R', 5],
  ['Kathua', 'JK', 32.37, 75.52, 'R', 6], ['Gulmarg', 'JK', 34.0484, 74.3805, 'S', 3], ['Pahalgam', 'JK', 34.0161, 75.315, 'S', 3], ['Sonamarg', 'JK', 34.3, 75.29, 'S', 4],
  // Ladakh
  ['Leh', 'LA', 34.1526, 77.5771, 'U', 4], ['Kargil', 'LA', 34.5539, 76.1349, 'U', 4], ['Leh–Manali Highway, Upshi', 'LA', 33.83, 77.81, 'H', 8], ['Nyoma', 'LA', 33.2, 78.65, 'R', 5],
  ['Diskit, Nubra', 'LA', 34.54, 77.56, 'S', 5], ['Tangtse, Pangong road', 'LA', 34.03, 78.17, 'S', 5], ['Lamayuru', 'LA', 34.28, 76.77, 'S', 4],
  // Lakshadweep
  ['Kavaratti', 'LD', 10.5626, 72.6369, 'U', 1], ['Agatti', 'LD', 10.857, 72.19, 'S', 1], ['Minicoy', 'LD', 8.277, 73.058, 'S', 1],
  // Puducherry
  ['Puducherry', 'PY', 11.9416, 79.8083, 'U', 3], ['Karaikal', 'PY', 10.9254, 79.838, 'U', 3], ['Yanam', 'PY', 16.733, 82.216, 'U', 1], ['Mahe', 'PY', 11.7, 75.535, 'S', 1],

  // Metro neighbourhoods (also feed All India urban rolls)
  ['Connaught Place', 'DL', 28.6315, 77.2167, 'M'], ['Chandni Chowk', 'DL', 28.6506, 77.2303, 'M', 2], ['Dwarka', 'DL', 28.5921, 77.046, 'M'], ['Rohini', 'DL', 28.7495, 77.0565, 'M'],
  ['Lajpat Nagar', 'DL', 28.5677, 77.2433, 'M', 2], ['Shahdara', 'DL', 28.6735, 77.289, 'M', 2], ['Gurugram', 'HR', 28.4595, 77.0266, 'M', 5], ['Noida', 'UP', 28.5355, 77.391, 'M', 5],
  ['Bandra', 'MH', 19.0596, 72.8295, 'M', 2], ['Andheri', 'MH', 19.1197, 72.8468, 'M', 2], ['Dadar', 'MH', 19.0178, 72.8478, 'M', 2], ['Thane', 'MH', 19.2183, 72.9781, 'M'],
  ['Vashi, Navi Mumbai', 'MH', 19.0771, 72.9986, 'M'], ['Borivali', 'MH', 19.2307, 72.8567, 'M', 2],
  ['Park Street', 'WB', 22.555, 88.352, 'M', 2], ['Salt Lake', 'WB', 22.58, 88.415, 'M', 2], ['Howrah', 'WB', 22.5958, 88.2636, 'M', 3], ['Garia', 'WB', 22.463, 88.39, 'M', 2], ['Dum Dum', 'WB', 22.62, 88.42, 'M', 2],
  ['T. Nagar', 'TN', 13.0418, 80.2341, 'M', 2], ['Adyar', 'TN', 13.0012, 80.2565, 'M', 2], ['Anna Nagar', 'TN', 13.085, 80.2101, 'M', 2], ['Tambaram', 'TN', 12.9249, 80.1, 'M'],
  ['MG Road, Bengaluru', 'KA', 12.975, 77.606, 'M', 2], ['Whitefield', 'KA', 12.9698, 77.75, 'M'], ['Jayanagar', 'KA', 12.925, 77.5938, 'M', 2], ['Yelahanka', 'KA', 13.1007, 77.5963, 'M'],
  ['Secunderabad', 'TG', 17.4399, 78.4983, 'M'], ['HITEC City', 'TG', 17.4435, 78.3772, 'M'], ['Charminar', 'TG', 17.3616, 78.4747, 'M', 2], ['LB Nagar', 'TG', 17.3457, 78.5522, 'M'],
  ['Navrangpura, Ahmedabad', 'GJ', 23.0365, 72.5611, 'M'], ['Maninagar, Ahmedabad', 'GJ', 22.9962, 72.603, 'M'],
  ['Shivajinagar, Pune', 'MH', 18.5308, 73.8475, 'M', 2], ['Kothrud, Pune', 'MH', 18.5074, 73.8077, 'M', 2], ['Hinjewadi, Pune', 'MH', 18.5913, 73.7389, 'M'],
];

function slug(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const INDIA_ANCHORS: Anchor[] = ROWS.map(([name, state, lat, lng, code, jitter]) => ({
  id: `${state.toLowerCase()}-${slug(name)}`,
  name,
  state,
  lat,
  lng,
  archetype: CODE_TO_ARCHETYPE[code],
  jitterRadiusKm: jitter ?? DEFAULT_JITTER_KM[code],
  ...(code === 'M' ? { metro: true } : {}),
}));
