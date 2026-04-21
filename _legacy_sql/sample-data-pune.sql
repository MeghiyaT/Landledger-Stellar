-- Sample Data for LandLedger - Maharashtra, Pune
-- Run this in your Supabase SQL Editor after running supabase-schema.sql

-- Insert sample properties in Pune, Maharashtra
INSERT INTO properties (title, location, address, price, bedrooms, bathrooms, sqft, year_built, type, description, features, images, featured) VALUES

-- Featured Properties
('Luxury Villa in Koregaon Park', 'Koregaon Park, Pune', 'Plot No. 45, North Main Road, Koregaon Park, Pune 411001', 35000000.00, 4, 5, 3500, 2021, 'house', 'Modern luxury villa in the heart of Koregaon Park, one of Pune''s most prestigious neighborhoods. Features contemporary architecture, smart home automation, and premium finishes throughout.', ARRAY['Smart Home System', 'Private Garden', 'Covered Parking (3 cars)', 'Security System', 'Modular Kitchen', 'Terrace Garden', 'Gym Area', 'Swimming Pool'], ARRAY['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800'], true),

('Premium Apartment at Kalyani Nagar', 'Kalyani Nagar, Pune', 'Tower B, 12th Floor, Nagar Road, Kalyani Nagar, Pune 411006', 12500000.00, 3, 3, 1850, 2022, 'apartment', 'Spacious 3 BHK apartment with stunning city views in one of Pune''s fastest-growing neighborhoods. Walking distance to restaurants, shopping centers, and IT parks.', ARRAY['Clubhouse', 'Swimming Pool', 'Gymnasium', 'Children''s Play Area', 'Power Backup', 'Security', '24/7 Water Supply', 'Covered Parking (2)'], ARRAY['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800'], true),

('Agricultural Land in Wagholi', 'Wagholi, Pune', 'Survey No. 125/3, Wagholi-Kharadi Road, Wagholi, Pune 412207', 8500000.00, 0, 0, 21780, 0, 'land', '5 acres of fertile agricultural land with clear title. Ideal for farming or future development. Connected by paved road, electricity available. Located near upcoming metro station.', ARRAY['Clear Title', 'Electricity Available', 'Water Connection', 'Road Access', 'Near Metro Station', 'Fertile Soil', 'Bore Well'], ARRAY['https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800', 'https://images.unsplash.com/photo-1589923188900-85dae523342b?w=800'], true),

-- Residential Properties
('Spacious 2 BHK at Hinjewadi', 'Hinjewadi Phase 1, Pune', 'Rajiv Gandhi Infotech Park Road, Hinjewadi Phase 1, Pune 411057', 7800000.00, 2, 2, 1100, 2020, 'apartment', 'Well-maintained apartment in the IT hub of Pune. Perfect for professionals working in nearby tech parks. Easy access to Mumbai-Pune Expressway.', ARRAY['Gated Community', 'Power Backup', 'Intercom', 'Lift', 'Security', 'Visitor Parking', 'Clubhouse'], ARRAY['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800'], false),

('Independent House in Kothrud', 'Kothrud, Pune', 'Lane 7, Paud Road, Kothrud, Pune 411038', 18500000.00, 3, 3, 2200, 2018, 'house', 'Beautiful independent house in established residential area. Near top schools, hospitals, and shopping centers. Well-connected to all parts of Pune.', ARRAY['Private Parking', 'Terrace', 'Garden', 'Bore Well', 'Solar Panels', 'Rainwater Harvesting', 'Modern Kitchen'], ARRAY['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800'], false),

('Affordable 1 BHK in Wakad', 'Wakad, Pune', 'Datta Mandir Road, Wakad, Pune 411057', 5200000.00, 1, 1, 650, 2019, 'apartment', 'Compact and efficient 1 BHK apartment, perfect for first-time buyers or investment. Located in rapidly developing Wakad area with good connectivity.', ARRAY['Lift', 'Security', 'Power Backup', 'Covered Parking', 'Piped Gas Connection'], ARRAY['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800'], false),

('Modern 3 BHK at Baner', 'Baner, Pune', 'Aundh-Baner Link Road, Baner, Pune 411045', 11200000.00, 3, 2, 1450, 2021, 'apartment', 'Contemporary design apartment with premium amenities in prime Baner location. Close to international schools, hospitals, and shopping malls.', ARRAY['Clubhouse', 'Swimming Pool', 'Gym', 'Indoor Games', 'Amphitheater', 'Jogging Track', 'Landscaped Gardens', 'Security'], ARRAY['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800', 'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=800'], false),

('Penthouse in Viman Nagar', 'Viman Nagar, Pune', 'Airport Road, Viman Nagar, Pune 411014', 28000000.00, 4, 4, 3200, 2022, 'apartment', 'Exclusive penthouse with panoramic city views. Features include private terrace, jacuzzi, and luxury fittings. Close to airport and business districts.', ARRAY['Private Terrace', 'Jacuzzi', 'Smart Home', 'Private Lift', 'Designer Kitchen', 'Home Theater Setup', 'Wine Cellar', 'Concierge Service'], ARRAY['https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800'], true),

-- Commercial Properties
('Commercial Office Space in Shivajinagar', 'Shivajinagar, Pune', 'JM Road, Shivajinagar, Pune 411005', 15500000.00, 0, 2, 1800, 2017, 'commercial', 'Prime commercial office space in the heart of Pune. Perfect for corporate offices, startups, or co-working spaces. Excellent public transport connectivity.', ARRAY['Reception Area', 'Conference Rooms', 'Pantry', 'Server Room', 'Parking', 'Security', '24/7 Access', 'Power Backup'], ARRAY['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800', 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800'], false),

('Retail Shop at Deccan Gymkhana', 'Deccan Gymkhana, Pune', 'FC Road, Deccan Gymkhana, Pune 411004', 22000000.00, 0, 1, 1200, 2015, 'commercial', 'High-visibility retail space on famous FC Road. Heavy foot traffic, ideal for restaurants, retail stores, or showrooms. Established commercial area.', ARRAY['Corner Property', 'High Foot Traffic', 'Wide Frontage', 'Parking Available', 'Good Visibility', 'Access from Main Road'], ARRAY['https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800'], false),

('Industrial Warehouse in Chakan', 'Chakan, Pune', 'Chakan Industrial Area, Pune 410501', 32000000.00, 0, 2, 12000, 2019, 'commercial', 'Modern industrial warehouse facility with excellent connectivity to Mumbai-Pune Expressway. Suitable for manufacturing, storage, or logistics operations.', ARRAY['Loading Dock', 'High Ceiling', 'Three Phase Power', 'Water Supply', 'Security', 'Office Space', 'Truck Parking', 'Fire Safety Systems'], ARRAY['https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800'], false),

-- Land Properties
('Residential Plot in Undri', 'Undri, Pune', 'Survey No. 78/2, Pisoli-Undri Road, Undri, Pune 411060', 4500000.00, 0, 0, 2000, 0, 'land', '2000 sq ft residential plot in PMRDA approved layout. Clear title, ready for construction. Good infrastructure development in the area.', ARRAY['PMRDA Approved', 'Clear Title', 'Electricity Available', 'Water Connection', 'Road Access', 'Compound Wall'], ARRAY['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800'], false),

('Commercial Plot at Hadapsar', 'Hadapsar, Pune', 'Survey No. 45/1, Pune-Solapur Highway, Hadapsar, Pune 411028', 18000000.00, 0, 0, 4000, 0, 'land', 'Prime commercial plot on main highway. Excellent visibility and connectivity. Ideal for showrooms, offices, or mixed-use development.', ARRAY['Highway Facing', 'Clear Title', 'Corner Plot', 'High Visibility', 'Wide Road Access', 'Commercial Zone'], ARRAY['https://images.unsplash.com/photo-1484417894907-623942c8ee29?w=800'], false),

('Farmhouse Plot in Mulshi', 'Mulshi, Pune', 'Survey No. 156/4, Near Mulshi Lake, Mulshi, Pune 412108', 12500000.00, 0, 0, 43560, 0, 'land', 'Scenic 1-acre plot near Mulshi Lake. Perfect for weekend farmhouse or eco-resort. Surrounded by nature with mountain views. Access to water and electricity.', ARRAY['Lake View', 'Mountain View', 'Natural Water Source', 'Electricity Connection', 'Peaceful Location', 'Road Access', 'Clear Title'], ARRAY['https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800'], true),

('Development Land in Manjri', 'Manjri, Pune', 'Survey No. 234/1, Manjri-Hadapsar Road, Manjri, Pune 412307', 25000000.00, 0, 0, 21780, 0, 'land', '5-acre parcel suitable for residential township or commercial development. Strategic location with metro connectivity planned. Clear land title.', ARRAY['Clear Title', 'RERA Approved Zone', 'Near Proposed Metro', 'Flat Terrain', 'Road Access', 'Electricity Available', 'High Appreciation Potential'], ARRAY['https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=800'], false);

-- Note: To add sample registrations, you'll need actual user IDs from auth.users table
-- After creating test users through your app, you can add sample registrations like:

/*
-- Example registration (replace user_id with actual UUID from your auth.users table)
INSERT INTO registrations (
  user_id, 
  property_type, 
  property_address, 
  property_size, 
  property_description,
  owner_name,
  owner_email,
  owner_phone,
  owner_id_number,
  status,
  estimated_completion_date
) VALUES (
  'YOUR_USER_UUID_HERE',
  'Residential',
  'Plot No. 23, Survey No. 45/2, Kharadi, Pune 411014',
  1500,
  '1500 sq ft residential plot in approved layout',
  'Rajesh Kumar',
  'rajesh.kumar@example.com',
  '+91 9876543210',
  'ABCDE1234F',
  'in_review',
  (CURRENT_DATE + INTERVAL '30 days')
);
*/

-- Verify the inserted data
SELECT 
  COUNT(*) as total_properties,
  COUNT(*) FILTER (WHERE type = 'apartment') as apartments,
  COUNT(*) FILTER (WHERE type = 'house') as houses,
  COUNT(*) FILTER (WHERE type = 'land') as land_properties,
  COUNT(*) FILTER (WHERE type = 'commercial') as commercial,
  COUNT(*) FILTER (WHERE featured = true) as featured_properties
FROM properties;








