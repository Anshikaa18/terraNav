"""Unit tests for data validation, coordinates, and physical travel-time conversion."""
import unittest
import numpy as np
from terranav.config import MIN_SPEED_FLOOR_KMH, IMPASSABLE_COST_SECONDS, KMH_TO_MPS
from terranav.data.validation import (
    validate_coordinates,
    validate_segment_length,
    speed_to_travel_time,
    travel_time_to_speed_kmh,
)


class TestDataValidation(unittest.TestCase):
    def test_coordinate_validation(self):
        # Valid coordinates in Bengaluru
        self.assertTrue(validate_coordinates(12.9716, 77.5946))
        # Invalid coordinates
        self.assertFalse(validate_coordinates(95.0, 77.0))
        self.assertFalse(validate_coordinates(12.0, 190.0))
        self.assertFalse(validate_coordinates(np.nan, 77.0))
        self.assertFalse(validate_coordinates(12.0, np.inf))

    def test_segment_length_validation(self):
        self.assertTrue(validate_segment_length(350.0))
        self.assertTrue(validate_segment_length(10.0))
        self.assertFalse(validate_segment_length(0.0))
        self.assertFalse(validate_segment_length(-100.0))
        self.assertFalse(validate_segment_length(np.nan))

    def test_speed_to_travel_time_conversion(self):
        # 1000m at 36 km/h (10 m/s) -> exactly 100 seconds
        t = speed_to_travel_time(length_meters=1000.0, speed_kmh=36.0)
        self.assertAlmostEqual(t, 100.0, places=2)

        # 500m at 72 km/h (20 m/s) -> exactly 25 seconds
        t2 = speed_to_travel_time(length_meters=500.0, speed_kmh=72.0)
        self.assertAlmostEqual(t2, 25.0, places=2)

    def test_speed_floor_protection(self):
        # Zero speed should be clamped to MIN_SPEED_FLOOR_KMH (5.0 km/h)
        t_zero = speed_to_travel_time(length_meters=1000.0, speed_kmh=0.0)
        expected_time = 1000.0 / (MIN_SPEED_FLOOR_KMH * KMH_TO_MPS)
        self.assertAlmostEqual(t_zero, expected_time, places=2)

        # Negative speed should also be clamped to MIN_SPEED_FLOOR_KMH
        t_neg = speed_to_travel_time(length_meters=1000.0, speed_kmh=-15.0)
        self.assertAlmostEqual(t_neg, expected_time, places=2)

    def test_road_closure_impassable_cost(self):
        t_closed = speed_to_travel_time(length_meters=500.0, speed_kmh=40.0, is_closed=True)
        self.assertEqual(t_closed, IMPASSABLE_COST_SECONDS)

    def test_round_trip_conversion(self):
        length = 1500.0
        speed_in = 45.0
        t = speed_to_travel_time(length, speed_in)
        speed_out = travel_time_to_speed_kmh(length, t)
        self.assertAlmostEqual(speed_in, speed_out, places=2)


if __name__ == "__main__":
    unittest.main()
