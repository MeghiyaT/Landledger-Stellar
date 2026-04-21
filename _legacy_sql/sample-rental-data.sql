-- Sample Rental Properties for Pune
-- Run this in your Supabase SQL Editor after running migration-add-listing-type.sql

-- Insert rental properties
INSERT INTO properties (title, location, address, price, bedrooms, bathrooms, sqft, year_built, type, description, features, images, featured, listing_type) VALUES

-- Residential Rentals
('Modern 2 BHK Apartment for Rent in Koregaon Park', 'Koregaon Park, Pune', 'Tower A, 5th Floor, North Main Road, Koregaon Park, Pune 411001', 45000.00, 2, 2, 1100, 2020, 'apartment', 'Spacious 2 BHK apartment in prime location. Fully furnished with modern amenities. Close to restaurants, cafes, and shopping centers. Perfect for working professionals or small families.', ARRAY['Fully Furnished', 'Modular Kitchen', 'Power Backup', 'Security', 'Lift', 'Parking', '24/7 Water Supply', 'Near Metro'], ARRAY['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800'], false, 'for_rent'),

('Luxury 3 BHK Villa for Rent in Kalyani Nagar', 'Kalyani Nagar, Pune', 'Villa No. 12, Nagar Road, Kalyani Nagar, Pune 411006', 85000.00, 3, 3, 2200, 2021, 'house', 'Beautiful independent villa with private garden and terrace. Fully furnished with premium furniture and appliances. Gated community with 24/7 security. Ideal for families.', ARRAY['Fully Furnished', 'Private Garden', 'Terrace', '3 Car Parking', 'Security', 'Power Backup', 'Swimming Pool Access', 'Clubhouse'], ARRAY['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800'], true, 'for_rent'),

('Cozy 1 BHK Apartment for Rent in Wakad', 'Wakad, Pune', 'Datta Mandir Road, Wakad, Pune 411057', 18000.00, 1, 1, 650, 2019, 'apartment', 'Compact and well-maintained 1 BHK apartment. Semi-furnished with essential appliances. Great connectivity to IT parks and Mumbai-Pune Expressway. Perfect for bachelors or working professionals.', ARRAY['Semi-Furnished', 'Power Backup', 'Lift', 'Security', 'Parking', 'Near IT Parks'], ARRAY['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800'], false, 'for_rent'),

('Spacious 4 BHK Penthouse for Rent in Viman Nagar', 'Viman Nagar, Pune', 'Airport Road, Viman Nagar, Pune 411014', 120000.00, 4, 4, 3200, 2022, 'apartment', 'Luxury penthouse with panoramic city views. Fully furnished with designer furniture. Private terrace, jacuzzi, and premium amenities. Close to airport and business districts.', ARRAY['Fully Furnished', 'Private Terrace', 'Jacuzzi', 'Smart Home', 'Private Lift', 'Designer Kitchen', 'Home Theater', 'Concierge'], ARRAY['https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800', 'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=800'], true, 'for_rent'),

('2 BHK Independent House for Rent in Kothrud', 'Kothrud, Pune', 'Lane 7, Paud Road, Kothrud, Pune 411038', 55000.00, 2, 2, 1400, 2018, 'house', 'Well-maintained independent house in established residential area. Semi-furnished with garden space. Near top schools, hospitals, and shopping centers. Great for families.', ARRAY['Semi-Furnished', 'Garden', 'Parking', 'Bore Well', 'Near Schools', 'Near Hospitals'], ARRAY['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800'], false, 'for_rent'),

('3 BHK Apartment for Rent in Baner', 'Baner, Pune', 'Aundh-Baner Link Road, Baner, Pune 411045', 65000.00, 3, 2, 1450, 2021, 'apartment', 'Modern apartment with premium amenities. Fully furnished with contemporary design. Close to international schools, hospitals, and shopping malls. Perfect for families.', ARRAY['Fully Furnished', 'Clubhouse', 'Swimming Pool', 'Gym', 'Indoor Games', 'Amphitheater', 'Jogging Track', 'Security'], ARRAY['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800', 'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=800'], false, 'for_rent'),

-- Commercial Rentals
('Office Space for Rent in Shivajinagar', 'Shivajinagar, Pune', 'JM Road, Shivajinagar, Pune 411005', 75000.00, 0, 2, 1800, 2017, 'commercial', 'Prime commercial office space in the heart of Pune. Ready to move in with reception area, conference rooms, and pantry. Excellent public transport connectivity. Perfect for corporate offices or startups.', ARRAY['Reception Area', 'Conference Rooms', 'Pantry', 'Server Room', 'Parking', 'Security', '24/7 Access', 'Power Backup'], ARRAY['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800', 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800'], false, 'for_rent'),

('Retail Shop for Rent at Deccan Gymkhana', 'Deccan Gymkhana, Pune', 'FC Road, Deccan Gymkhana, Pune 411004', 45000.00, 0, 1, 1200, 2015, 'commercial', 'High-visibility retail space on famous FC Road. Heavy foot traffic area, ideal for restaurants, retail stores, or showrooms. Established commercial area with good parking.', ARRAY['Corner Property', 'High Foot Traffic', 'Wide Frontage', 'Parking Available', 'Good Visibility', 'Main Road Access'], ARRAY['https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800'], false, 'for_rent'),

('Warehouse for Rent in Chakan', 'Chakan, Pune', 'Chakan Industrial Area, Pune 410501', 95000.00, 0, 2, 12000, 2019, 'commercial', 'Modern industrial warehouse facility with excellent connectivity to Mumbai-Pune Expressway. Suitable for manufacturing, storage, or logistics operations. Office space included.', ARRAY['Loading Dock', 'High Ceiling', 'Three Phase Power', 'Water Supply', 'Security', 'Office Space', 'Truck Parking', 'Fire Safety'], ARRAY['https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800'], false, 'for_rent');







