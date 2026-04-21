-- Sample Ownership History for Existing Properties
-- Run this in your Supabase SQL Editor after running migration-add-ownership-history.sql

-- Update existing properties with sample ownership history
-- This adds realistic ownership chains to demonstrate the feature

-- Property 1: Luxury Villa in Koregaon Park
UPDATE properties 
SET ownership_history = '[
  {
    "owner_name": "Rajesh Kumar",
    "from_date": "2015-03-15",
    "to_date": "2019-08-20",
    "transfer_type": "sale",
    "notes": "Original purchase from developer"
  },
  {
    "owner_name": "Priya Sharma",
    "from_date": "2019-08-20",
    "to_date": "2021-12-10",
    "transfer_type": "sale",
    "notes": "Purchased for investment purposes"
  },
  {
    "owner_name": "Amit Patel",
    "from_date": "2021-12-10",
    "transfer_type": "sale",
    "notes": "Current owner - selling due to relocation"
  }
]'::jsonb
WHERE title = 'Luxury Villa in Koregaon Park';

-- Property 2: Premium Apartment at Kalyani Nagar
UPDATE properties 
SET ownership_history = '[
  {
    "owner_name": "Suresh Desai",
    "from_date": "2020-01-10",
    "to_date": "2022-06-15",
    "transfer_type": "sale",
    "notes": "First owner after construction"
  },
  {
    "owner_name": "Meera Joshi",
    "from_date": "2022-06-15",
    "transfer_type": "sale",
    "notes": "Current owner"
  }
]'::jsonb
WHERE title = 'Premium Apartment at Kalyani Nagar';

-- Property 3: Agricultural Land in Wagholi
UPDATE properties 
SET ownership_history = '[
  {
    "owner_name": "Late Ramesh Deshpande",
    "from_date": "1985-01-01",
    "to_date": "2020-05-20",
    "transfer_type": "other",
    "notes": "Original landowner, agricultural use"
  },
  {
    "owner_name": "Vikram Deshpande",
    "from_date": "2020-05-20",
    "transfer_type": "inheritance",
    "notes": "Inherited from father, current owner"
  }
]'::jsonb
WHERE title = 'Agricultural Land in Wagholi';

-- Property 4: Spacious 2 BHK at Hinjewadi
UPDATE properties 
SET ownership_history = '[
  {
    "owner_name": "Anjali Reddy",
    "from_date": "2018-04-12",
    "to_date": "2021-11-30",
    "transfer_type": "sale",
    "notes": "Purchased for personal use"
  },
  {
    "owner_name": "Rahul Singh",
    "from_date": "2021-11-30",
    "transfer_type": "sale",
    "notes": "Current owner - IT professional"
  }
]'::jsonb
WHERE title = 'Spacious 2 BHK at Hinjewadi';

-- Property 5: Independent House in Kothrud
UPDATE properties 
SET ownership_history = '[
  {
    "owner_name": "Dr. Sunil Kulkarni",
    "from_date": "2010-02-28",
    "to_date": "2017-09-15",
    "transfer_type": "sale",
    "notes": "Built and owned by original builder"
  },
  {
    "owner_name": "Kavita Patil",
    "from_date": "2017-09-15",
    "to_date": "2023-01-20",
    "transfer_type": "sale",
    "notes": "Family residence"
  },
  {
    "owner_name": "Nikhil Mehta",
    "from_date": "2023-01-20",
    "transfer_type": "sale",
    "notes": "Current owner - selling due to job transfer"
  }
]'::jsonb
WHERE title = 'Independent House in Kothrud';

-- Property 6: Affordable 1 BHK in Wakad
UPDATE properties 
SET ownership_history = '[
  {
    "owner_name": "Prakash Iyer",
    "from_date": "2017-08-05",
    "transfer_type": "sale",
    "notes": "First and current owner - selling for upgrade"
  }
]'::jsonb
WHERE title = 'Affordable 1 BHK in Wakad';

-- Property 7: Modern 3 BHK at Baner
UPDATE properties 
SET ownership_history = '[
  {
    "owner_name": "Deepak Agarwal",
    "from_date": "2019-11-22",
    "to_date": "2022-03-10",
    "transfer_type": "sale",
    "notes": "Investment property"
  },
  {
    "owner_name": "Sneha Kapoor",
    "from_date": "2022-03-10",
    "transfer_type": "sale",
    "notes": "Current owner"
  }
]'::jsonb
WHERE title = 'Modern 3 BHK at Baner';

-- Property 8: Penthouse in Viman Nagar
UPDATE properties 
SET ownership_history = '[
  {
    "owner_name": "Rohit Malhotra",
    "from_date": "2020-07-01",
    "to_date": "2023-08-15",
    "transfer_type": "sale",
    "notes": "Luxury penthouse, premium location"
  },
  {
    "owner_name": "Arjun Khanna",
    "from_date": "2023-08-15",
    "transfer_type": "sale",
    "notes": "Current owner - relocating abroad"
  }
]'::jsonb
WHERE title = 'Penthouse in Viman Nagar';

-- Property 9: Commercial Office Space in Shivajinagar
UPDATE properties 
SET ownership_history = '[
  {
    "owner_name": "TechSpace Developers",
    "from_date": "2015-06-01",
    "to_date": "2019-12-31",
    "transfer_type": "sale",
    "notes": "Original developer and owner"
  },
  {
    "owner_name": "Business Solutions Pvt Ltd",
    "from_date": "2019-12-31",
    "transfer_type": "sale",
    "notes": "Current owner - commercial property"
  }
]'::jsonb
WHERE title = 'Commercial Office Space in Shivajinagar';

-- Property 10: Retail Shop at Deccan Gymkhana
UPDATE properties 
SET ownership_history = '[
  {
    "owner_name": "Late Mohan Pawar",
    "from_date": "2005-01-15",
    "to_date": "2021-04-10",
    "transfer_type": "other",
    "notes": "Original shop owner, family business"
  },
  {
    "owner_name": "Sandeep Pawar",
    "from_date": "2021-04-10",
    "transfer_type": "inheritance",
    "notes": "Inherited from father, current owner"
  }
]'::jsonb
WHERE title = 'Retail Shop at Deccan Gymkhana';

-- Property 11: Industrial Warehouse in Chakan
UPDATE properties 
SET ownership_history = '[
  {
    "owner_name": "Industrial Estates Ltd",
    "from_date": "2017-03-20",
    "to_date": "2022-09-05",
    "transfer_type": "sale",
    "notes": "Built and operated by industrial developer"
  },
  {
    "owner_name": "Logistics Hub India",
    "from_date": "2022-09-05",
    "transfer_type": "sale",
    "notes": "Current owner - logistics company"
  }
]'::jsonb
WHERE title = 'Industrial Warehouse in Chakan';

-- Property 12: Residential Plot in Undri
UPDATE properties 
SET ownership_history = '[
  {
    "owner_name": "PMRDA Development Authority",
    "from_date": "2018-01-01",
    "to_date": "2020-07-15",
    "transfer_type": "sale",
    "notes": "Allocated by PMRDA"
  },
  {
    "owner_name": "Sanjay Verma",
    "from_date": "2020-07-15",
    "transfer_type": "sale",
    "notes": "Current owner - plot ready for construction"
  }
]'::jsonb
WHERE title = 'Residential Plot in Undri';

-- Property 13: Commercial Plot at Hadapsar
UPDATE properties 
SET ownership_history = '[
  {
    "owner_name": "Highway Developers Group",
    "from_date": "2014-05-10",
    "to_date": "2019-11-25",
    "transfer_type": "sale",
    "notes": "Original developer"
  },
  {
    "owner_name": "Retail Ventures Pvt Ltd",
    "from_date": "2019-11-25",
    "transfer_type": "sale",
    "notes": "Current owner - commercial development planned"
  }
]'::jsonb
WHERE title = 'Commercial Plot at Hadapsar';

-- Property 14: Farmhouse Plot in Mulshi
UPDATE properties 
SET ownership_history = '[
  {
    "owner_name": "Maharashtra Forest Department",
    "from_date": "1995-01-01",
    "to_date": "2010-03-15",
    "transfer_type": "other",
    "notes": "Government land allocation"
  },
  {
    "owner_name": "Nature Resorts Pvt Ltd",
    "from_date": "2010-03-15",
    "to_date": "2018-09-20",
    "transfer_type": "sale",
    "notes": "Eco-tourism development planned"
  },
  {
    "owner_name": "Rajesh and Meera Desai",
    "from_date": "2018-09-20",
    "transfer_type": "sale",
    "notes": "Current owners - weekend farmhouse project"
  }
]'::jsonb
WHERE title = 'Farmhouse Plot in Mulshi';

-- Property 15: Development Land in Manjri
UPDATE properties 
SET ownership_history = '[
  {
    "owner_name": "PMRDA (Pune Metropolitan Region Development Authority)",
    "from_date": "2012-06-01",
    "to_date": "2017-11-10",
    "transfer_type": "other",
    "notes": "Government land acquisition for development"
  },
  {
    "owner_name": "Metro Developers Consortium",
    "from_date": "2017-11-10",
    "to_date": "2021-04-05",
    "transfer_type": "sale",
    "notes": "Township development project"
  },
  {
    "owner_name": "Greenfield Infrastructure Ltd",
    "from_date": "2021-04-05",
    "transfer_type": "sale",
    "notes": "Current owner - mixed-use development planned"
  }
]'::jsonb
WHERE title = 'Development Land in Manjri';

-- Verify the updates
SELECT 
  title,
  jsonb_array_length(ownership_history) as ownership_records_count
FROM properties
WHERE ownership_history IS NOT NULL 
  AND jsonb_array_length(ownership_history) > 0
ORDER BY title;

SELECT 'Sample ownership history added to all properties!' as message;

